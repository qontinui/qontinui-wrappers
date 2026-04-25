/**
 * Vercel v0 auth.
 *
 * The v0 API accepts a long-lived personal access token as the `Authorization`
 * bearer. No refresh flow exists on the public surface, so this module is
 * thin — read once from env, surface a helpful error when missing.
 *
 * v0 API surface may change — verify against their current docs.
 */

export interface V0AuthConfig {
  accessToken: string;
  apiBaseUrl: string;
}

export function readV0AuthConfig(env: NodeJS.ProcessEnv = process.env): V0AuthConfig {
  const accessToken = env['V0_ACCESS_TOKEN'];
  if (!accessToken) {
    throw new Error(
      'v0 wrapper: missing V0_ACCESS_TOKEN. Create one at ' +
        'https://vercel.com/account/tokens and add it to .env.'
    );
  }
  const apiBaseUrl = env['V0_API_BASE_URL'] ?? 'https://api.v0.dev';
  return { accessToken, apiBaseUrl };
}

/** Build the default fetch headers v0 expects. */
export function buildAuthHeaders(config?: V0AuthConfig): Record<string, string> {
  const resolved = config ?? readV0AuthConfig();
  return {
    Authorization: `Bearer ${resolved.accessToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}
