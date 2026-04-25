#!/usr/bin/env node
/**
 * Interactive Gmail OAuth loopback flow.
 *
 * One-shot CLI that:
 *   1. Reads `GMAIL_OAUTH_CLIENT_ID` / `GMAIL_OAUTH_CLIENT_SECRET` from env.
 *   2. Spins up an HTTP server on `127.0.0.1:<ephemeral>` (`:0` so the OS
 *      picks an unused port).
 *   3. Builds the Google consent URL pointed at that loopback redirect and
 *      prints it (and best-effort opens it in the platform browser).
 *   4. Validates the `state` round-trip on the redirect, exchanges the auth
 *      code for tokens via `OAuth2Client.getToken`, prints the resulting
 *      `refresh_token` in copy-pasteable form, and exits 0.
 *
 * Why this script exists: `auth.ts` is intentionally a thin runtime helper
 * that assumes `GMAIL_REFRESH_TOKEN` is already provisioned. Provisioning
 * one is a one-time interactive chore — keeping it here means the runtime
 * module stays a pure, testable boundary while operators still have a
 * supported path to mint a token without writing the loopback flow
 * themselves.
 *
 * Credential resolution: process.env first, then `.env.local`, then `.env`
 * in the current working directory. Pre-existing process.env values always
 * win — file-loaded values are pure fallback. This matches the wrapper's
 * own runtime entrypoint behavior so the same `.env.local` works for both
 * minting the token and running the wrapper.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { config as loadDotenv } from 'dotenv';
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

// Load credentials from .env.local then .env. Existing process.env wins.
// Both calls silently no-op when files don't exist.
loadDotenv({ path: '.env.local', override: false, quiet: true });
loadDotenv({ path: '.env', override: false, quiet: true });

/** Single Gmail scope kept in lockstep with `auth.ts` / runtime usage. */
export const GMAIL_OAUTH_SETUP_SCOPE = 'https://www.googleapis.com/auth/gmail.modify';

export interface OAuthSetupConfig {
  clientId: string;
  clientSecret: string;
}

export interface BuildAuthUrlInput {
  client: OAuth2Client;
  state: string;
}

/**
 * Build the consent-screen URL we direct the user's browser at.
 *
 * `access_type=offline` + `prompt=consent` is the documented combo to force
 * Google to mint a fresh refresh token on every run — without `prompt`,
 * subsequent runs return only an access token if the user has already
 * consented, which defeats the entire point of the script.
 */
export function buildAuthUrl({ client, state }: BuildAuthUrlInput): string {
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [GMAIL_OAUTH_SETUP_SCOPE],
    state,
    response_type: 'code',
  });
}

/** Read required env vars; returns null and prints a clear error if missing. */
export function readSetupConfig(env: NodeJS.ProcessEnv = process.env): OAuthSetupConfig | null {
  const clientId = env['GMAIL_OAUTH_CLIENT_ID'];
  const clientSecret = env['GMAIL_OAUTH_CLIENT_SECRET'];
  if (!clientId || !clientSecret) {
    process.stderr.write(
      'Error: GMAIL_OAUTH_CLIENT_ID and GMAIL_OAUTH_CLIENT_SECRET must be set.\n' +
        'See .env.example in the wrapper-gmail package for the expected variables;\n' +
        'export them in your shell or place them in your `.env` and `source` it before\n' +
        'running this script (env-only by design — no dotenv loader is bundled here).\n'
    );
    return null;
  }
  return { clientId, clientSecret };
}

/**
 * Validate a callback request. Returns the `code` on success, or an Error
 * describing what went wrong so the caller can both 4xx the browser and
 * exit non-zero.
 */
export function parseCallback(
  rawUrl: string,
  expectedState: string,
  expectedPath = '/oauth/callback'
): { code: string } | Error {
  // `rawUrl` from Node's http module is just the path+query — give URL a
  // base so it parses regardless.
  let parsed: URL;
  try {
    parsed = new URL(rawUrl, 'http://127.0.0.1');
  } catch {
    return new Error(`unparseable callback URL: ${rawUrl}`);
  }
  if (parsed.pathname !== expectedPath) {
    return new Error(`unexpected path ${parsed.pathname}`);
  }
  const errParam = parsed.searchParams.get('error');
  if (errParam) {
    // Google sends `?error=access_denied` etc. when the user declines.
    return new Error(`OAuth consent failed: ${errParam}`);
  }
  const state = parsed.searchParams.get('state');
  if (state !== expectedState) {
    return new Error('state mismatch — possible CSRF or stale browser tab');
  }
  const code = parsed.searchParams.get('code');
  if (!code) {
    return new Error('callback missing `code` parameter');
  }
  return { code };
}

/** Best-effort cross-platform "open this URL in the user's browser". */
function tryOpenBrowser(url: string): void {
  // Resolve a (command, args) pair per platform; print-the-URL is the
  // contract, so swallow all errors here — if the spawn fails (no GUI, no
  // xdg-open, sandboxed CI) the user still has the printed URL to copy.
  let cmd: string;
  let args: string[];
  if (process.platform === 'win32') {
    // `start` is a cmd.exe builtin; the empty "" is the window title slot
    // that `start` requires when the first quoted arg would otherwise be
    // treated as the title.
    cmd = 'cmd';
    args = ['/c', 'start', '""', url];
  } else if (process.platform === 'darwin') {
    cmd = 'open';
    args = [url];
  } else {
    cmd = 'xdg-open';
    args = [url];
  }
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.on('error', () => {
      /* swallow — user already has the URL printed above */
    });
    child.unref();
  } catch {
    /* swallow */
  }
}

interface RunOptions {
  /** Override the timeout (ms) the loopback server waits for a callback. */
  timeoutMs?: number;
  /** Skip the best-effort `open <url>` spawn (used by tests). */
  skipBrowser?: boolean;
}

/**
 * Drive the full loopback flow end-to-end. Resolves with the refresh token
 * on success; rejects with an Error the CLI catches and prints.
 */
export async function runOAuthSetup(
  config: OAuthSetupConfig,
  options: RunOptions = {}
): Promise<string> {
  const { timeoutMs = 5 * 60 * 1000, skipBrowser = false } = options;
  const state = randomBytes(16).toString('hex');

  return new Promise<string>((resolve, reject) => {
    // The oauth2 client gets created inside the listen callback (it needs
    // the resolved port for redirect_uri), but the request handler is
    // attached up front via createServer. We close over this mutable
    // holder so handleCallback can reach the client once it's wired.
    let oauth2: OAuth2Client | null = null;

    let settled = false;
    function finish(err: Error | null, token?: string): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      server.close(() => {
        if (err) reject(err);
        else if (token) resolve(token);
        else reject(new Error('no token and no error — should be unreachable'));
      });
    }

    async function handleCallback(req: IncomingMessage, res: ServerResponse): Promise<void> {
      if (!req.url) {
        res.statusCode = 400;
        res.end('missing url');
        return;
      }
      const result = parseCallback(req.url, state);
      if (result instanceof Error) {
        // Favicon / unrelated probe: don't tear down on a non-callback path.
        if (/unexpected path/.test(result.message)) {
          res.statusCode = 404;
          res.end('not found');
          return;
        }
        res.statusCode = 400;
        res.end(`OAuth callback failed: ${result.message}`);
        finish(result);
        return;
      }
      if (!oauth2) {
        // Should be unreachable — listen() always populates this before
        // any redirect could plausibly arrive — but guard rather than `!`.
        const err = new Error('internal: oauth2 client not initialized');
        res.statusCode = 500;
        res.end(err.message);
        finish(err);
        return;
      }
      try {
        const tokenResp = await oauth2.getToken(result.code);
        const refreshToken = tokenResp.tokens.refresh_token;
        if (!refreshToken) {
          // Google omits refresh_token if the user previously consented
          // and we didn't force `prompt=consent`. We do force it, so this
          // is unexpected, but report it clearly rather than handing the
          // operator an undefined-paste.
          const err = new Error(
            'token exchange succeeded but no refresh_token was returned. ' +
              'Revoke the Gmail wrapper at https://myaccount.google.com/permissions and re-run.'
          );
          res.statusCode = 500;
          res.end(err.message);
          finish(err);
          return;
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(
          '<!doctype html><html><body style="font-family:sans-serif;padding:2em">' +
            '<h2>Gmail wrapper authorized</h2>' +
            '<p>You can close this tab now and return to your terminal.</p>' +
            '</body></html>'
        );
        finish(null, refreshToken);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.statusCode = 500;
        res.end(`token exchange failed: ${message}`);
        finish(err instanceof Error ? err : new Error(message));
      }
    }

    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      handleCallback(req, res).catch((err: unknown) => {
        // handleCallback owns resolve/reject; this catch only exists so an
        // unexpected throw inside the handler closure doesn't leave the
        // server lingering.
        finish(err instanceof Error ? err : new Error(String(err)));
      });
    });

    const timer = setTimeout(() => {
      finish(new Error(`timed out after ${Math.round(timeoutMs / 1000)}s waiting for OAuth callback`));
    }, timeoutMs);
    timer.unref();

    server.on('error', (err) => finish(err));

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        finish(new Error('failed to read loopback server address'));
        return;
      }
      const redirectUri = `http://127.0.0.1:${addr.port}/oauth/callback`;
      oauth2 = new google.auth.OAuth2(
        config.clientId,
        config.clientSecret,
        redirectUri
      );
      const url = buildAuthUrl({ client: oauth2, state });

      process.stdout.write(
        '\nOpen this URL in your browser to authorize the Gmail wrapper:\n\n' +
          `  ${url}\n\n` +
          `(Listening on ${redirectUri} — this tab will redirect back here when you click Allow.)\n\n`
      );
      if (!skipBrowser) tryOpenBrowser(url);
    });
  });
}

/** CLI entry point. Wraps `runOAuthSetup` with env-read + pretty output. */
async function main(): Promise<void> {
  const config = readSetupConfig();
  if (!config) {
    process.exit(1);
  }
  try {
    const refreshToken = await runOAuthSetup(config);
    process.stdout.write(
      '\n✓ Got refresh token. Add this to your .env:\n\n' +
        `  GMAIL_REFRESH_TOKEN=${refreshToken}\n\n`
    );
    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`\nOAuth setup failed: ${message}\n`);
    process.exit(2);
  }
}

// Run only when invoked directly (not when imported by tests). tsup
// emits CJS for this entry, so `require.main === module` is the
// canonical guard. The `typeof` checks keep this safe if the compiled
// output is ever loaded in an ESM-only context (tests import the named
// exports above and never trigger this branch).
const isCjsEntrypoint =
  typeof require !== 'undefined' &&
  typeof module !== 'undefined' &&
  require.main === module;
if (isCjsEntrypoint) {
  void main();
}
