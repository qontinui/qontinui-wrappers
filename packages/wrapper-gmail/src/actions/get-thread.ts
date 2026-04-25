/**
 * Action: `get-thread`
 *
 * Fetches a full Gmail thread by id and projects it to a JSON-safe shape
 * suitable for crossing the UI Bridge.
 */

import { withRetry, withAuthRefresh, paramSchemaOf } from '@qontinui/ui-bridge-wrapper';
import { DEFAULT_USER_ID, getCachedOAuth, getGmailClient } from '../client.js';
import { refreshAccessToken } from '../auth.js';
import { toThreadMessage, type ThreadDetail } from './shared.js';

export interface GetThreadParams {
  threadId: string;
}

export interface GetThreadResult {
  thread: ThreadDetail;
}

export const getThreadParamSchema = paramSchemaOf({
  threadId: 'string',
});

export async function getThread(
  params: GetThreadParams | undefined
): Promise<GetThreadResult> {
  const threadId = params?.threadId;
  if (!threadId || typeof threadId !== 'string') {
    throw new Error("get-thread requires a 'threadId' string param");
  }

  const run = async (): Promise<GetThreadResult> => {
    const gmail = getGmailClient();
    const resp = await gmail.users.threads.get({
      userId: DEFAULT_USER_ID,
      id: threadId,
      format: 'full',
    });
    const messages = (resp.data.messages ?? []).map(toThreadMessage);
    return {
      thread: {
        id: resp.data.id ?? threadId,
        messages,
      },
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
