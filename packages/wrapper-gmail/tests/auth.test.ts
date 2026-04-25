/**
 * Tests for OAuth helpers.
 *
 * Keeps the test surface small — we're verifying the env-read contract and
 * that `getAuthorizedClient` constructs a client with a refresh token set.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const BASE_ENV: Record<string, string> = {
  GMAIL_OAUTH_CLIENT_ID: 'cid',
  GMAIL_OAUTH_CLIENT_SECRET: 'secret',
  GMAIL_REFRESH_TOKEN: 'refresh',
};

beforeEach(() => {
  for (const [k, v] of Object.entries(BASE_ENV)) {
    process.env[k] = v;
  }
});

afterEach(() => {
  for (const k of Object.keys(BASE_ENV)) {
    delete process.env[k];
  }
  vi.resetModules();
});

describe('readGmailAuthConfig', () => {
  it('reads the three required env vars', async () => {
    const { readGmailAuthConfig } = await import('../src/auth.js');
    const cfg = readGmailAuthConfig();
    expect(cfg).toEqual({
      clientId: 'cid',
      clientSecret: 'secret',
      refreshToken: 'refresh',
    });
  });

  it('throws when any required env var is missing', async () => {
    delete process.env['GMAIL_REFRESH_TOKEN'];
    const { readGmailAuthConfig } = await import('../src/auth.js');
    expect(() => readGmailAuthConfig()).toThrow(/missing env vars/);
  });

  it('includes redirectUri when provided', async () => {
    process.env['GMAIL_OAUTH_REDIRECT_URI'] = 'http://127.0.0.1:3000/cb';
    const { readGmailAuthConfig } = await import('../src/auth.js');
    expect(readGmailAuthConfig().redirectUri).toBe('http://127.0.0.1:3000/cb');
    delete process.env['GMAIL_OAUTH_REDIRECT_URI'];
  });
});

describe('getAuthorizedClient', () => {
  it('constructs an OAuth2 client with credentials set', async () => {
    const setCredentials = vi.fn();
    vi.doMock('googleapis', () => ({
      google: {
        auth: {
          OAuth2: class {
            setCredentials(creds: Record<string, unknown>): void {
              setCredentials(creds);
            }
          },
        },
      },
    }));
    const { getAuthorizedClient } = await import('../src/auth.js');
    const client = getAuthorizedClient();
    expect(client).toBeTruthy();
    expect(setCredentials).toHaveBeenCalledWith({ refresh_token: 'refresh' });
  });
});

describe('runInteractiveOAuthFlow', () => {
  it('is stubbed with a helpful error message', async () => {
    const { runInteractiveOAuthFlow } = await import('../src/auth.js');
    await expect(runInteractiveOAuthFlow()).rejects.toThrow(/oauth-setup/);
  });
});
