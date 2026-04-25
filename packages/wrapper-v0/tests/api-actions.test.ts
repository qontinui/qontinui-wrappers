/**
 * Tests for the v0 api-transport actions.
 *
 * Mocks the global `fetch` so the action's http behavior is exercised end-
 * to-end (auth header, JSON body, retry wrapper) without real network I/O.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  process.env['V0_ACCESS_TOKEN'] = 'tok';
  process.env['V0_API_BASE_URL'] = 'https://api.test';
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

function mockFetchOnce(result: unknown, init: { status?: number; contentType?: string } = {}): void {
  const status = init.status ?? 200;
  const ct = init.contentType ?? 'application/json';
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(typeof result === 'string' ? result : JSON.stringify(result), {
        status,
        headers: { 'content-type': ct },
      })
    )
  );
}

describe('iterate-component (api-only)', () => {
  it('POSTs to the iterations endpoint with the prompt', async () => {
    mockFetchOnce({ iterationId: 'iter-99' });
    const { iterateComponent } = await import('../src/actions/iterate-component.js');
    const result = await iterateComponent.handler(
      { componentId: 'abc', prompt: 'make it darker' },
      { kind: 'api' }
    );
    expect(result).toEqual({ iterationId: 'iter-99' });
    const fetchSpy = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.test/v1/components/abc/iterations',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
      })
    );
  });

  it('throws on missing componentId', async () => {
    mockFetchOnce({});
    const { iterateComponent } = await import('../src/actions/iterate-component.js');
    await expect(
      iterateComponent.handler({ componentId: '', prompt: 'x' }, { kind: 'api' })
    ).rejects.toThrow(/componentId/);
  });
});

describe('list-recent', () => {
  it('normalizes camelCase + snake_case responses', async () => {
    mockFetchOnce({
      components: [
        { id: 'a', title: 'Alpha', updatedAt: '2026-01-01' },
        { id: 'b', name: 'Beta', updated_at: '2026-01-02' },
      ],
    });
    const { listRecent } = await import('../src/actions/list-recent.js');
    const result = await listRecent.handler({ limit: 5 }, { kind: 'api' });
    expect(result.components).toEqual([
      { id: 'a', title: 'Alpha', updatedAt: '2026-01-01' },
      { id: 'b', title: 'Beta', updatedAt: '2026-01-02' },
    ]);
  });
});

describe('export-code', () => {
  it('hits the iteration-scoped path when iterationId is provided', async () => {
    mockFetchOnce({ files: { 'app.tsx': 'export const App = () => null;' } });
    const { exportCode } = await import('../src/actions/export-code.js');
    const result = await exportCode.handler(
      { componentId: 'comp-1', iterationId: 'iter-2' },
      { kind: 'api' }
    );
    const fetchSpy = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.test/v1/components/comp-1/iterations/iter-2/export',
      expect.anything()
    );
    expect(result.files['app.tsx']).toContain('App');
  });
});

describe('create-component (api path)', () => {
  it('returns componentId and url from the response', async () => {
    mockFetchOnce({ id: 'new-1', url: 'https://v0.app/r/new-1' });
    const { createComponent } = await import('../src/actions/create-component.js');
    const result = await createComponent.handler(
      { prompt: 'a settings page' },
      { kind: 'api' }
    );
    expect(result).toEqual({ componentId: 'new-1', url: 'https://v0.app/r/new-1' });
  });

  it('surfaces HTTP failures with status info', async () => {
    mockFetchOnce('nope', { status: 500, contentType: 'text/plain' });
    const { createComponent } = await import('../src/actions/create-component.js');
    await expect(
      createComponent.handler({ prompt: 'x' }, { kind: 'api' })
    ).rejects.toThrow(/500/);
  });
});
