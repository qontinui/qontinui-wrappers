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
  it('POSTs the message and reads latestVersion.id from the ChatDetail response', async () => {
    // Per OpenAPI, chats.sendMessage returns ChatDetail — single call,
    // no follow-up GET needed.
    mockFetchOnce({
      id: 'abc',
      object: 'chat',
      latestVersion: { id: 'ver-99', object: 'version' },
    });
    const { iterateComponent } = await import('../src/actions/iterate-component.js');
    const result = await iterateComponent.handler(
      { componentId: 'abc', prompt: 'make it darker' },
      { kind: 'api' }
    );
    expect(result).toEqual({ iterationId: 'ver-99' });
    const fetchSpy = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.test/v1/chats/abc/messages',
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

describe('download-component (api-only)', () => {
  /** Stub fetch with a binary Response. Subsequent test sequences are not
   *  supported by this helper — use mockFetchSequence for multi-call paths.
   *  Wraps bytes in a Blob to satisfy TS's BodyInit typing (Uint8Array is
   *  a valid BodyInit at runtime but lib.dom.d.ts's union is narrower). */
  function mockBinaryFetchOnce(bytes: Uint8Array, contentType: string): void {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Blob([bytes as BlobPart]), {
        status: 200,
        headers: { 'content-type': contentType },
      }))
    );
  }

  it('hits the version-scoped download endpoint and returns base64 bytes', async () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xde, 0xad, 0xbe, 0xef]); // PK\x03\x04 + payload
    mockBinaryFetchOnce(bytes, 'application/zip');
    const { downloadComponent } = await import('../src/actions/download-component.js');
    const result = await downloadComponent.handler(
      { componentId: 'chat-x', iterationId: 'ver-y' },
      { kind: 'api' }
    );
    expect(result.format).toBe('zip');
    expect(result.byteLength).toBe(bytes.byteLength);
    // Decode base64 round-trip and confirm bytes match.
    const decoded = Buffer.from(result.base64, 'base64');
    expect(Array.from(decoded)).toEqual(Array.from(bytes));

    const fetchSpy = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.test/v1/chats/chat-x/versions/ver-y/download',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Accept: 'application/zip' }),
      })
    );
  });

  it('falls back to chat.latestVersion.id when iterationId is omitted', async () => {
    // Two calls: GET /chats/{id} for version discovery, GET .../download for bytes.
    let callIdx = 0;
    const bytes = new Uint8Array([0x1f, 0x8b, 0x08, 0x00]); // gzip magic
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        if (callIdx++ === 0) {
          return new Response(JSON.stringify({
            id: 'chat-x',
            object: 'chat',
            latestVersion: { id: 'ver-latest', object: 'version' },
          }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        return new Response(new Blob([bytes as BlobPart]), {
          status: 200,
          headers: { 'content-type': 'application/gzip' },
        });
      })
    );
    const { downloadComponent } = await import('../src/actions/download-component.js');
    const result = await downloadComponent.handler(
      { componentId: 'chat-x', format: 'gzip' },
      { kind: 'api' }
    );
    expect(result.format).toBe('gzip');
    expect(result.byteLength).toBe(bytes.byteLength);

    const fetchSpy = (globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      'https://api.test/v1/chats/chat-x',
      expect.objectContaining({ method: 'GET' })
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      'https://api.test/v1/chats/chat-x/versions/ver-latest/download',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Accept: 'application/gzip' }),
      })
    );
  });

  it('throws when chat has no latestVersion and no iterationId given', async () => {
    mockFetchOnce({ id: 'chat-empty', object: 'chat' }); // no latestVersion
    const { downloadComponent } = await import('../src/actions/download-component.js');
    await expect(
      downloadComponent.handler({ componentId: 'chat-empty' }, { kind: 'api' })
    ).rejects.toThrow(/no latestVersion/);
  });

  it('throws on missing componentId', async () => {
    mockFetchOnce({});
    const { downloadComponent } = await import('../src/actions/download-component.js');
    await expect(
      downloadComponent.handler({ componentId: '' }, { kind: 'api' })
    ).rejects.toThrow(/componentId/);
  });

  it("reports actual response format when v0 ignores the gzip Accept hint", async () => {
    // Live behavior verified 2026-04-25: v0's downloadVersion always sends
    // application/zip even when the client requests gzip. The wrapper must
    // not lie about that — `result.format` should reflect what came back,
    // not what was requested.
    const zipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    mockBinaryFetchOnce(zipBytes, 'application/zip');
    const { downloadComponent } = await import('../src/actions/download-component.js');
    const result = await downloadComponent.handler(
      { componentId: 'chat-x', iterationId: 'ver-y', format: 'gzip' },
      { kind: 'api' }
    );
    expect(result.format).toBe('zip'); // not 'gzip' even though caller asked
  });
});
