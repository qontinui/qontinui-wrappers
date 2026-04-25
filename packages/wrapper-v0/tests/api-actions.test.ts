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

interface MockOptions {
  status?: number;
  contentType?: string;
}

function buildResponse(result: unknown, init: MockOptions = {}): Response {
  const status = init.status ?? 200;
  const ct = init.contentType ?? 'application/json';
  return new Response(typeof result === 'string' ? result : JSON.stringify(result), {
    status,
    headers: { 'content-type': ct },
  });
}

function mockFetchOnce(result: unknown, init: MockOptions = {}): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => buildResponse(result, init))
  );
}

/**
 * Mock a sequence of fetch responses. Each call to fetch returns the next
 * item in the sequence; if more calls are made than items provided, the
 * last item is reused (matches the retry-friendly semantics of
 * mockFetchOnce). Use this for actions that hit multiple endpoints in one
 * handler invocation.
 */
function mockFetchSequence(
  items: Array<{ result: unknown; init?: MockOptions }>
): void {
  let i = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      const idx = Math.min(i, items.length - 1);
      i += 1;
      const entry = items[idx]!;
      return buildResponse(entry.result, entry.init);
    })
  );
}

describe('iterate-component (api-only)', () => {
  it('POSTs the message then re-fetches chat detail for latestVersion.id', async () => {
    mockFetchSequence([
      // 1) POST /v1/chats/{id}/messages — response shape varies; we just
      //    need it to be a 200 JSON.
      { result: { id: 'msg-1', object: 'message' } },
      // 2) GET /v1/chats/{id} — used to read latestVersion.id.
      {
        result: {
          id: 'abc',
          object: 'chat',
          latestVersion: { id: 'ver-99', object: 'version' },
        },
      },
    ]);
    const { iterateComponent } = await import('../src/actions/iterate-component.js');
    const result = await iterateComponent.handler(
      { componentId: 'abc', prompt: 'make it darker' },
      { kind: 'api' }
    );
    expect(result).toEqual({ iterationId: 'ver-99' });
    const fetchSpy = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    // First call: POST messages.
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      'https://api.test/v1/chats/abc/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
      })
    );
    // Second call: GET chat detail.
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      'https://api.test/v1/chats/abc',
      expect.objectContaining({ method: 'GET' })
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
  it('reads /v1/chats and normalizes camelCase + snake_case row shapes', async () => {
    mockFetchOnce({
      object: 'list',
      data: [
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
    const fetchSpy = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.test/v1/chats?limit=5',
      expect.any(Object)
    );
  });
});

describe('export-code', () => {
  it('hits the version-scoped path when iterationId is provided', async () => {
    mockFetchOnce({
      id: 'ver-2',
      object: 'version',
      files: [
        { object: 'file', name: 'app.tsx', content: 'export const App = () => null;', locked: false },
      ],
    });
    const { exportCode } = await import('../src/actions/export-code.js');
    const result = await exportCode.handler(
      { componentId: 'comp-1', iterationId: 'ver-2' },
      { kind: 'api' }
    );
    const fetchSpy = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.test/v1/chats/comp-1/versions/ver-2',
      expect.anything()
    );
    expect(result.files['app.tsx']).toContain('App');
  });

  it('falls back to chat.latestVersion.id when iterationId is omitted', async () => {
    mockFetchSequence([
      // 1) GET /v1/chats/{id} → discover latest version.
      {
        result: {
          id: 'comp-1',
          object: 'chat',
          latestVersion: { id: 'ver-latest', object: 'version' },
        },
      },
      // 2) GET /v1/chats/{id}/versions/{vid} → files.
      {
        result: {
          id: 'ver-latest',
          object: 'version',
          files: [
            {
              object: 'file',
              name: 'page.tsx',
              content: 'export default function Page() { return null; }',
              locked: false,
            },
          ],
        },
      },
    ]);
    const { exportCode } = await import('../src/actions/export-code.js');
    const result = await exportCode.handler(
      { componentId: 'comp-1' },
      { kind: 'api' }
    );
    const fetchSpy = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      'https://api.test/v1/chats/comp-1',
      expect.objectContaining({ method: 'GET' })
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      'https://api.test/v1/chats/comp-1/versions/ver-latest',
      expect.objectContaining({ method: 'GET' })
    );
    expect(result.files['page.tsx']).toContain('Page');
  });
});

describe('create-component (api path)', () => {
  it('POSTs to /v1/chats and returns componentId + url from chat detail', async () => {
    mockFetchOnce({
      id: 'chat-new-1',
      object: 'chat',
      webUrl: 'https://v0.app/chat/chat-new-1',
    });
    const { createComponent } = await import('../src/actions/create-component.js');
    const result = await createComponent.handler(
      { prompt: 'a settings page' },
      { kind: 'api' }
    );
    expect(result).toEqual({
      componentId: 'chat-new-1',
      url: 'https://v0.app/chat/chat-new-1',
    });
    const fetchSpy = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.test/v1/chats',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
      })
    );
    // Inspect the body — should contain `message: <prompt>` (v0 contract),
    // not the legacy `prompt: ...`.
    const callArgs = fetchSpy.mock.calls[0]!;
    const init = callArgs[1] as RequestInit;
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body['message']).toBe('a settings page');
    expect(body['responseMode']).toBe('sync');
  });

  it('surfaces HTTP failures with status info', async () => {
    mockFetchOnce('nope', { status: 500, contentType: 'text/plain' });
    const { createComponent } = await import('../src/actions/create-component.js');
    await expect(
      createComponent.handler({ prompt: 'x' }, { kind: 'api' })
    ).rejects.toThrow(/500/);
  });
});
