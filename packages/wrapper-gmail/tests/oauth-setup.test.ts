/**
 * Tests for the OAuth loopback setup script.
 *
 * The actual browser → Google → loopback round-trip can't be exercised in
 * Vitest, so we cover the deterministic pieces:
 *   - env-read contract (`readSetupConfig`)
 *   - URL construction (scope, prompt, state, redirect)
 *   - callback parsing including state-mismatch and consent-denial paths
 *
 * Anything that requires real Google credentials is documented in the
 * README and validated manually.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  GMAIL_OAUTH_SETUP_SCOPE,
  buildAuthUrl,
  parseCallback,
  readSetupConfig,
} from '../src/scripts/oauth-setup.js';

describe('readSetupConfig', () => {
  it('returns the credentials when both env vars are set', () => {
    const cfg = readSetupConfig({
      GMAIL_OAUTH_CLIENT_ID: 'cid',
      GMAIL_OAUTH_CLIENT_SECRET: 'csecret',
    });
    expect(cfg).toEqual({ clientId: 'cid', clientSecret: 'csecret' });
  });

  it('returns null and writes to stderr when client id is missing', () => {
    const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const cfg = readSetupConfig({ GMAIL_OAUTH_CLIENT_SECRET: 'csecret' });
    expect(cfg).toBeNull();
    expect(errSpy).toHaveBeenCalled();
    const message = String(errSpy.mock.calls[0]?.[0] ?? '');
    expect(message).toMatch(/GMAIL_OAUTH_CLIENT_ID/);
    expect(message).toMatch(/\.env\.example/);
    errSpy.mockRestore();
  });

  it('returns null when client secret is missing', () => {
    const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const cfg = readSetupConfig({ GMAIL_OAUTH_CLIENT_ID: 'cid' });
    expect(cfg).toBeNull();
    errSpy.mockRestore();
  });
});

describe('buildAuthUrl', () => {
  /** Minimal stub of `OAuth2Client.generateAuthUrl` — captures the params. */
  function fakeClient(): {
    generateAuthUrl: (opts: Record<string, unknown>) => string;
    captured: Record<string, unknown> | null;
  } {
    const captured: { value: Record<string, unknown> | null } = { value: null };
    return {
      generateAuthUrl(opts: Record<string, unknown>): string {
        captured.value = opts;
        return 'https://accounts.google.com/o/oauth2/v2/auth?stub=1';
      },
      get captured(): Record<string, unknown> | null {
        return captured.value;
      },
    };
  }

  it('passes the gmail.modify scope, offline access, and forced consent', () => {
    const client = fakeClient();
    const url = buildAuthUrl({
      // The signature wants OAuth2Client; the stub matches the only method
      // we actually call. Cast through unknown to satisfy the structural
      // check without dragging in the full googleapis types here.
      client: client as unknown as Parameters<typeof buildAuthUrl>[0]['client'],
      state: 'abc123',
    });
    expect(url).toContain('accounts.google.com');
    expect(client.captured).toEqual({
      access_type: 'offline',
      prompt: 'consent',
      scope: [GMAIL_OAUTH_SETUP_SCOPE],
      state: 'abc123',
      response_type: 'code',
    });
  });

  it('uses the same scope string the runtime auth helper expects', () => {
    // Lockstep guard: if someone changes one and not the other, this fails
    // loudly. The literal here mirrors the scope used in src/auth.ts via
    // the runtime gmail-API calls (gmail.modify covers list/get/send/modify).
    expect(GMAIL_OAUTH_SETUP_SCOPE).toBe('https://www.googleapis.com/auth/gmail.modify');
  });
});

describe('parseCallback', () => {
  const STATE = 'good-state';

  it('extracts the code on a happy-path redirect', () => {
    const result = parseCallback(`/oauth/callback?code=auth-code-123&state=${STATE}`, STATE);
    expect(result).toEqual({ code: 'auth-code-123' });
  });

  it('returns an Error when state does not match', () => {
    const result = parseCallback('/oauth/callback?code=x&state=wrong', STATE);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toMatch(/state mismatch/);
  });

  it('surfaces Google-side error params (e.g. user denied consent)', () => {
    const result = parseCallback(
      `/oauth/callback?error=access_denied&state=${STATE}`,
      STATE
    );
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toMatch(/access_denied/);
  });

  it('flags missing code even when state is valid', () => {
    const result = parseCallback(`/oauth/callback?state=${STATE}`, STATE);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toMatch(/missing `code`/);
  });

  it('returns an unexpected-path Error for unrelated probes', () => {
    // Browsers fetching /favicon.ico shouldn't tear down the flow — the
    // server treats this Error as "respond 404, keep listening".
    const result = parseCallback('/favicon.ico', STATE);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toMatch(/unexpected path/);
  });
});
