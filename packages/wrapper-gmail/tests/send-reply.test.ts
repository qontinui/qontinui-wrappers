/**
 * Tests for the `send-reply` action.
 *
 * Verifies the handler threads replies correctly (pulls the latest
 * message's `From`, `Subject`, and `Message-ID`), base64url-encodes the
 * MIME body, and posts to `gmail.users.messages.send`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  process.env['GMAIL_OAUTH_CLIENT_ID'] = 'fake-id';
  process.env['GMAIL_OAUTH_CLIENT_SECRET'] = 'fake-secret';
  process.env['GMAIL_REFRESH_TOKEN'] = 'fake-refresh';
});

afterEach(() => {
  vi.resetModules();
});

describe('send-reply', () => {
  it('builds a threaded reply from the latest message on the thread', async () => {
    const threadsGet = vi.fn().mockResolvedValue({
      data: {
        messages: [
          {
            id: 'm1',
            payload: {
              headers: [
                { name: 'From', value: 'first@test' },
                { name: 'Subject', value: 'Topic' },
              ],
            },
          },
          {
            id: 'm2',
            payload: {
              headers: [
                { name: 'From', value: 'reply-to@test' },
                { name: 'Subject', value: 'Re: Topic' },
                { name: 'Message-ID', value: '<msg-2@test>' },
                { name: 'References', value: '<msg-1@test>' },
              ],
            },
          },
        ],
      },
    });
    const messagesSend = vi
      .fn()
      .mockResolvedValue({ data: { id: 'sent-1', threadId: 'T' } });

    vi.doMock('googleapis', () => ({
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
            threads: { get: threadsGet },
            messages: { send: messagesSend },
          },
        }),
      },
    }));

    const { sendReply } = await import('../src/actions/send-reply.js');
    const { __resetGmailClientForTests } = await import('../src/client.js');
    __resetGmailClientForTests();

    const result = await sendReply({ threadId: 'T', body: 'Hello back' });

    expect(threadsGet).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'T', format: 'metadata' })
    );
    expect(messagesSend).toHaveBeenCalledTimes(1);
    const sendCall = messagesSend.mock.calls[0]![0] as {
      requestBody: { threadId: string; raw: string };
    };
    expect(sendCall.requestBody.threadId).toBe('T');
    const decoded = Buffer.from(sendCall.requestBody.raw, 'base64url').toString('utf8');
    expect(decoded).toContain('To: reply-to@test');
    expect(decoded).toContain('Subject: Re: Topic');
    expect(decoded).toContain('In-Reply-To: <msg-2@test>');
    expect(decoded).toContain('References: <msg-1@test> <msg-2@test>');
    expect(decoded).toContain('Hello back');

    expect(result).toEqual({ id: 'sent-1', threadId: 'T' });
  });

  it('throws when threadId or body is missing', async () => {
    vi.doMock('googleapis', () => ({
      google: {
        auth: {
          OAuth2: class {
            setCredentials(): void {}
          },
        },
        gmail: () => ({ users: { threads: { get: vi.fn() }, messages: { send: vi.fn() } } }),
      },
    }));
    const { sendReply } = await import('../src/actions/send-reply.js');
    await expect(sendReply({ threadId: '', body: 'x' })).rejects.toThrow(/threadId/);
    await expect(
      sendReply({ threadId: 't', body: undefined as unknown as string })
    ).rejects.toThrow(/body/);
  });
});
