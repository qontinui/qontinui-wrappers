/**
 * Action: `send-reply`
 *
 * Posts a plain-text reply to an existing Gmail thread. Pulls `To`/`Subject`
 * /`Message-ID` from the most recent message on the thread so the reply
 * threads correctly in Gmail's UI.
 */

import { withRetry, withAuthRefresh, paramSchemaOf } from '@qontinui/ui-bridge-wrapper';
import { DEFAULT_USER_ID, getCachedOAuth, getGmailClient } from '../client.js';
import { refreshAccessToken } from '../auth.js';
import { encodeReplyMime, readHeader } from './shared.js';

export interface SendReplyParams {
  threadId: string;
  body: string;
}

export interface SendReplyResult {
  id: string;
  threadId: string;
}

export const sendReplyParamSchema = paramSchemaOf({
  threadId: 'string',
  body: 'string',
});

export async function sendReply(
  params: SendReplyParams | undefined
): Promise<SendReplyResult> {
  const threadId = params?.threadId;
  const body = params?.body;
  if (!threadId || typeof threadId !== 'string') {
    throw new Error("send-reply requires a 'threadId' string param");
  }
  if (typeof body !== 'string') {
    throw new Error("send-reply requires a 'body' string param");
  }

  const run = async (): Promise<SendReplyResult> => {
    const gmail = getGmailClient();
    const thread = await gmail.users.threads.get({
      userId: DEFAULT_USER_ID,
      id: threadId,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Message-ID', 'References'],
    });
    const messages = thread.data.messages ?? [];
    const latest = messages[messages.length - 1];
    const to = readHeader(latest, 'From');
    const subject = readHeader(latest, 'Subject');
    const inReplyTo = readHeader(latest, 'Message-ID');
    const existingRefs = readHeader(latest, 'References');
    const references = existingRefs
      ? `${existingRefs} ${inReplyTo}`.trim()
      : inReplyTo;

    const raw = encodeReplyMime({
      to,
      subject,
      body,
      inReplyTo: inReplyTo || undefined,
      references: references || undefined,
    });

    const send = await gmail.users.messages.send({
      userId: DEFAULT_USER_ID,
      requestBody: {
        threadId,
        raw,
      },
    });
    return {
      id: send.data.id ?? '',
      threadId: send.data.threadId ?? threadId,
    };
  };

  return withAuthRefresh(
    () => withRetry(run, { attempts: 3, baseMs: 250 }),
    async () => {
      const oauth = getCachedOAuth();
      if (oauth) await refreshAccessToken(oauth);
    }
  );
}
