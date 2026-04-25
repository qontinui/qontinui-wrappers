/**
 * Action: `archive`
 *
 * Removes the `INBOX` label from a message — the standard Gmail "archive"
 * operation.
 */

import { withRetry, withAuthRefresh, paramSchemaOf } from '@qontinui/ui-bridge-wrapper';
import { DEFAULT_USER_ID, getCachedOAuth, getGmailClient } from '../client.js';
import { refreshAccessToken } from '../auth.js';

export interface ArchiveParams {
  messageId: string;
}

export interface ArchiveResult {
  success: true;
}

export const archiveParamSchema = paramSchemaOf({
  messageId: 'string',
});

export async function archive(
  params: ArchiveParams | undefined
): Promise<ArchiveResult> {
  const messageId = params?.messageId;
  if (!messageId || typeof messageId !== 'string') {
    throw new Error("archive requires a 'messageId' string param");
  }

  const run = async (): Promise<ArchiveResult> => {
    const gmail = getGmailClient();
    await gmail.users.messages.modify({
      userId: DEFAULT_USER_ID,
      id: messageId,
      requestBody: {
        removeLabelIds: ['INBOX'],
      },
    });
    return { success: true as const };
  };

  return withAuthRefresh(
    () => withRetry(run, { attempts: 3, baseMs: 250 }),
    async () => {
      const oauth = getCachedOAuth();
      if (oauth) await refreshAccessToken(oauth);
    }
  );
}
