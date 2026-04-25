/**
 * Smoke test — registers Gmail handlers against a `MockTransport` and
 * verifies the registry contains the expected action ids, plus that
 * dispatching routes through the mocked googleapis client.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockTransport } from '@qontinui/_testing-harness';
import { GMAIL_ACTION_IDS } from '../src/handlers.js';

beforeEach(() => {
  process.env['GMAIL_OAUTH_CLIENT_ID'] = 'cid';
  process.env['GMAIL_OAUTH_CLIENT_SECRET'] = 'secret';
  process.env['GMAIL_REFRESH_TOKEN'] = 'refresh';
});

afterEach(() => {
  vi.resetModules();
});

describe('registerHandlers', () => {
  it('registers all five Gmail action ids on the transport', async () => {
    vi.doMock('googleapis', () => ({
      google: {
        auth: { OAuth2: class { setCredentials(): void {} } },
        gmail: () => ({ users: { messages: {}, threads: {} } }),
      },
    }));

    const { registerHandlers } = await import('../src/handlers.js');
    const transport = new MockTransport();
    registerHandlers(transport);

    for (const id of GMAIL_ACTION_IDS) {
      expect(transport.handlerRegistry.has(id)).toBe(true);
    }
    expect(transport.handlerRegistry.list().sort()).toEqual(
      [...GMAIL_ACTION_IDS].sort()
    );
  });

  it('dispatches archive through the registered handler', async () => {
    const modify = vi.fn().mockResolvedValue({ data: {} });
    vi.doMock('googleapis', () => ({
      google: {
        auth: { OAuth2: class { setCredentials(): void {} } },
        gmail: () => ({
          users: { messages: { modify }, threads: {} },
        }),
      },
    }));

    const { registerHandlers } = await import('../src/handlers.js');
    const { __resetGmailClientForTests } = await import('../src/client.js');
    __resetGmailClientForTests();

    const transport = new MockTransport();
    registerHandlers(transport);

    const result = await transport.dispatch('archive', { messageId: 'abc' });
    expect(result).toEqual({ success: true });
    expect(modify).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'abc',
        requestBody: { removeLabelIds: ['INBOX'] },
      })
    );
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]).toMatchObject({ actionId: 'archive' });
  });
});
