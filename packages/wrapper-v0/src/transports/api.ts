/**
 * Thin HTTP client for v0's public API.
 *
 * v0 API surface may change — verify against their current docs. This
 * module intentionally keeps its fetch call-sites self-describing (full
 * URL + body literal) so a future schema migration is a single-file diff.
 */

import { buildAuthHeaders, readV0AuthConfig, type V0AuthConfig } from '../auth.js';

export interface V0ApiClient {
  post<T = unknown>(path: string, body: unknown): Promise<T>;
  get<T = unknown>(path: string): Promise<T>;
}

export function createV0ApiClient(config?: V0AuthConfig): V0ApiClient {
  const resolved = config ?? readV0AuthConfig();
  const headers = buildAuthHeaders(resolved);

  async function request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${resolved.apiBaseUrl}${path}`;
    const init: RequestInit = {
      method,
      headers,
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    const resp = await fetch(url, init);
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      const err = new Error(
        `v0 api error ${resp.status} ${resp.statusText} for ${method} ${path}: ${text.slice(0, 256)}`
      );
      (err as { status?: number }).status = resp.status;
      throw err;
    }
    const ct = resp.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      return (await resp.json()) as T;
    }
    return (await resp.text()) as unknown as T;
  }

  return {
    post: <T = unknown>(path: string, body: unknown) => request<T>('POST', path, body),
    get: <T = unknown>(path: string) => request<T>('GET', path),
  };
}
