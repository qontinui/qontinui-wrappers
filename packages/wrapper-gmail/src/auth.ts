/**
 * Gmail OAuth helpers.
 *
 * Production path: read `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET`,
 * and `GMAIL_REFRESH_TOKEN` from the environment, construct an OAuth2Client
 * with those, and return it. The `googleapis` client refreshes the access
 * token automatically when it expires.
 *
 * The interactive loopback flow that mints a fresh refresh token is
 * intentionally out of scope here — provision one up front via
 * `node dist/scripts/oauth-setup.js` (see README) and paste the result into
 * `.env`. Centralizing the refresh flow keeps this module a tiny, testable
 * boundary.
 */

import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

export interface GmailAuthConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  /** Optional fully-resolved redirect URI; only used for the interactive script. */
  redirectUri?: string;
}

/** Read config from `process.env`, throwing if required fields are missing. */
export function readGmailAuthConfig(env: NodeJS.ProcessEnv = process.env): GmailAuthConfig {
  const clientId = env['GMAIL_OAUTH_CLIENT_ID'];
  const clientSecret = env['GMAIL_OAUTH_CLIENT_SECRET'];
  const refreshToken = env['GMAIL_REFRESH_TOKEN'];
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Gmail wrapper: missing env vars. Set GMAIL_OAUTH_CLIENT_ID, ' +
        'GMAIL_OAUTH_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN (see .env.example).'
    );
  }
  const redirectUri = env['GMAIL_OAUTH_REDIRECT_URI'];
  const config: GmailAuthConfig = { clientId, clientSecret, refreshToken };
  if (redirectUri) config.redirectUri = redirectUri;
  return config;
}

/**
 * Build an authorized `OAuth2Client` pre-loaded with the refresh token.
 *
 * Each call returns a fresh client — callers should cache it at module
 * scope (see `client.ts::getGmailClient`) to avoid redundant token swaps.
 */
export function getAuthorizedClient(config?: GmailAuthConfig): OAuth2Client {
  const resolved = config ?? readGmailAuthConfig();
  const oauth2 = new google.auth.OAuth2(
    resolved.clientId,
    resolved.clientSecret,
    resolved.redirectUri
  );
  oauth2.setCredentials({ refresh_token: resolved.refreshToken });
  return oauth2;
}

/**
 * Force a refresh of the cached access token. Used by `withAuthRefresh` when
 * the API surfaces a 401 — the underlying `googleapis` client already
 * auto-refreshes, but an explicit call lets us recover from stale in-memory
 * state deterministically in tests and on long-lived servers.
 */
export async function refreshAccessToken(oauth2: OAuth2Client): Promise<void> {
  const { credentials } = await oauth2.refreshAccessToken();
  oauth2.setCredentials(credentials);
}

/**
 * Placeholder for the interactive loopback flow.
 *
 * Implemented as a stub here; a fleshed-out CLI script that opens the
 * consent URL and captures the code over a one-shot HTTP server lives in
 * `src/scripts/oauth-setup.ts` (intentionally not implemented in this
 * phase — see README).
 */
export async function runInteractiveOAuthFlow(): Promise<never> {
  throw new Error(
    'Interactive OAuth flow not implemented. Run `node dist/scripts/oauth-setup.js` ' +
      'after provisioning that helper, or mint a refresh token manually via the ' +
      'Google Cloud console and paste it into .env.'
  );
}
