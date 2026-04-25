/**
 * Action: `search`
 *
 * Runs an arbitrary Gmail query (`q=` parameter on `users.messages.list`)
 * and returns a summary projection of the matches.
 */

import { withRetry, withAuthRefresh, paramSchemaOf } from '@qontinui/ui-bridge-wrapper';
import { DEFAULT_USER_ID, getCachedOAuth, getGmailClient } from '../client.js';
import { refreshAccessToken } from '../auth.js';
import { toMessageSummary, type MessageSummary } from './shared.js';

export interface SearchParams {
  /** Gmail search query — e.g. `from:alice@example.com has:attachment`. */
  query: string;
  /** Max messages to return. Defaults to 25, capped at 100. */
  limit?: number;
}

export interface SearchResult {
  messages: MessageSummary[];
}

export const searchParamSchema = paramSchemaOf({
  query: 'string',
  limit: { type: 'number', optional: true },
});

export async function search(
  params: SearchParams | undefined
): Promise<SearchResult> {
  const query = params?.query;
  if (!query || typeof query !== 'string') {
    throw new Error("search requires a 'query' string param");
  }
  const limit = Math.min(Math.max(params?.limit ?? 25, 1), 100);

  const run = async (): Promise<SearchResult> => {
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
