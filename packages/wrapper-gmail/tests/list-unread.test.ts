/**
 * Tests for the `list-unread` action.
 *
 * We mock `googleapis` at the module boundary so the handler logic is
 * exercised end-to-end (client construction, retry wrapper, projection)
 * without touching the network or requiring real credentials.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Stub env so `readGmailAuthConfig()` succeeds during client construction.
beforeEach(() => {
  process.env['GMAIL_OAUTH_CLIENT_ID'] = 'fake-id';
  process.env['GMAIL_OAUTH_CLIENT_SECRET'] = 'fake-secret';
  process.env['GMAIL_REFRESH_TOKEN'] = 'fake-refresh';
});

afterEach(() => {
  vi.resetModules();
});

// Helper — mounts a single consistent mock per test.
function mountGoogleApisMock(opts: {
  list: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
}): void {
  vi.doMock('googleapis', () => {
    return {
      google: {
        auth: {
          OAuth2: class {
            setCredentials(): void {}
            async refreshAccessToken(): Promise<{ credentials: Record<string, unknown> }> {
              return { credentials: {} };
            }
          },
        },
        gmail: () => ({
          users: {
            messages: {
              list: opts.list,
              get: opts.get,
            },
          },
        }),
      },
    };
  });
}

describe('list-unread', () => {
  it('fetches unread ids and hydrates summaries', async () => {
    const list = vi.fn().mockResolvedValue({
      data: { messages: [{ id: 'a' }, { id: 'b' }] },
    });
    const get = vi.fn(async ({ id }: { id: string }) => ({
      data: {
        id,
        threadId: `thread-${id}`,
        snippet: `snippet-${id}`,
        payload: {
          headers: [
            { name: 'From', value: `sender-${id}@test` },
            { name: 'Subject', value: `subject-${id}` },
            { name: 'Date', value: 'Thu, 1 Jan 1970 00:00:00 +0000' },
          ],
        },
      },
    }));
    mountGoogleApisMock({ list, get });

    const { listUnread } = await import('../src/actions/list-unread.js');
    const { __resetGmailClientForTests } = await import('../src/client.js');
    __resetGmailClientForTests();

    const result = await listUnread({ limit: 5 });

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ maxResults: 5, q: 'is:unread in:inbox' })
    );
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toMatchObject({
      id: 'a',
      threadId: 'thread-a',
      snippet: 'snippet-a',
      from: 'sender-a@test',
      subject: 'subject-a',
    });
  });

  it('retries once on a transient failure then succeeds', async () => {
    let listCalls = 0;
    const list = vi.fn(async () => {
      listCalls += 1;
      if (listCalls === 1) throw new Error('transient ECONNRESET');
      return { data: { messages: [{ id: 'only' }] } };
    });
    const get = vi.fn().mockResolvedValue({
      data: {
        id: 'only',
        threadId: 't',
        snippet: '',
        payload: { headers: [] },
      },
    });
    mountGoogleApisMock({ list, get });

    const { listUnread } = await import('../src/actions/list-unread.js');
    const { __resetGmailClientForTests } = await import('../src/client.js');
    __resetGmailClientForTests();

    const result = await listUnread({});

    expect(listCalls).toBe(2);
    expect(result.messages).toHaveLength(1);
  });

  it('appends user-supplied query to is:unread filter', async () => {
    const list = vi.fn().mockResolvedValue({ data: { messages: [] } });
    const get = vi.fn();
    mountGoogleApisMock({ list, get });

    const { listUnread } = await import('../src/actions/list-unread.js');
    const { __resetGmailClientForTests } = await import('../src/client.js');
    __resetGmailClientForTests();

    await listUnread({ query: 'from:alerts@example.com' });

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'is:unread in:inbox from:alerts@example.com' })
    );
  });
});
