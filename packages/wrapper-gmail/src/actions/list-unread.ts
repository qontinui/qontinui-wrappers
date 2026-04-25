/**
 * Action: `list-unread`
 *
 * Returns a summary projection of unread messages in the authenticated
 * user's inbox. Wraps each API call in `withRetry` + `withAuthRefresh`.
 */

import { withRetry, withAuthRefresh, paramSchemaOf } from '@qontinui/ui-bridge-wrapper';
import { DEFAULT_USER_ID, getCachedOAuth, getGmailClient } from '../client.js';
import { refreshAccessToken } from '../auth.js';
import { toMessageSummary, type MessageSummary } from './shared.js';

export interface ListUnreadParams {
  /** Max messages to return. Defaults to 20, capped at 100. */
  limit?: number;
  /** Additional Gmail search operators AND-ed with `is:unread`. */
  query?: string;
}

export interface ListUnreadResult {
  messages: MessageSummary[];
}

export const listUnreadParamSchema = paramSchemaOf({
  limit: { type: 'number', optional: true },
  query: { type: 'string', optional: true },
});

export async function listUnread(
  params: ListUnreadParams | undefined
): Promise<ListUnreadResult> {
  const limit = Math.min(Math.max(params?.limit ?? 20, 1), 100);
  const base = 'is:unread in:inbox';
  const query = params?.query ? `${base} ${params.query}` : base;

  const run = async (): Promise<ListUnreadResult> => {
    const gmail = getGmailClient();
    const list = await gmail.users.messages.list({
      userId: DEFAULT_USER_ID,
      q: query,
      maxResults: limit,
    });
    const ids = (list.data.messages ?? []).map((m) => m.id).filter((id): id is string => !!id);

    const messages = await Promise.all(
      ids.map(async (id) => {
        const detail = await gmail.users.messages.get({
          userId: DEFAULT_USER_ID,
          id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });
        return toMessageSummary(detail.data);
      })
    );
    return { messages };
  };

  return withAuthRefresh(
    () => withRetry(run, { attempts: 3, baseMs: 250 }),
    async () => {
      const oauth = getCachedOAuth();
      if (oauth) await refreshAccessToken(oauth);
    }
  );
}
