/**
 * Lazily-constructed `gmail_v1.Gmail` client.
 *
 * Module-scoped cache so every action reuses the same authorized client,
 * and the googleapis transport keeps its internal token cache warm.
 * Tests reset the cache between runs via `__resetGmailClientForTests`.
 */

import { google, type gmail_v1 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { getAuthorizedClient } from './auth.js';

let cachedClient: gmail_v1.Gmail | null = null;
let cachedOAuth: OAuth2Client | null = null;

/**
 * Return the shared Gmail client, creating it on first call.
 */
export function getGmailClient(): gmail_v1.Gmail {
  if (cachedClient) return cachedClient;
  cachedOAuth = getAuthorizedClient();
  cachedClient = google.gmail({ version: 'v1', auth: cachedOAuth });
  return cachedClient;
}

/** Return the `OAuth2Client` backing the shared Gmail client. */
export function getCachedOAuth(): OAuth2Client | null {
  return cachedOAuth;
}

/** Test-only: drop the cached client so `vi.mock('googleapis')` can take effect. */
export function __resetGmailClientForTests(): void {
  cachedClient = null;
  cachedOAuth = null;
}

/** Default Gmail user id (`"me"` resolves to the authenticated user). */
export const DEFAULT_USER_ID: string = process.env['GMAIL_USER_ID'] ?? 'me';
