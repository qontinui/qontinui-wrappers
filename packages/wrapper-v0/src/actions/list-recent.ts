/**
 * Action: `list-recent`
 *
 * Returns a page of the authenticated user's recent v0 chats. v0's API
 * unit is "chat" — a generation conversation that may produce multiple
 * component versions. This action surfaces chat metadata; for individual
 * version details use `iterate-component` or `export-code`.
 *
 * Endpoint: GET /v1/chats?limit=N → { object: "list", data: [...] }
 *
 * v0 API surface may still change — verify against their current docs.
 */

import { withRetry, paramSchemaOf } from '@qontinui/ui-bridge-wrapper';
import { createV0ApiClient } from '../transports/api.js';
import type { ActionDescriptor } from './types.js';

export interface ListRecentParams {
  limit?: number;
}

/**
 * One v0 chat (formerly called "component" in this wrapper's surface, kept
 * under the historical type name for backward compatibility — internally
 * it's a chat in v0's data model).
 */
export interface ComponentSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface ListRecentResult {
  components: ComponentSummary[];
}

export const listRecentParamSchema = paramSchemaOf({
  limit: { type: 'number', optional: true },
});

const supports = ['api'] as const;

interface V0ChatRow {
  id?: string;
  name?: string;
  title?: string;
  updatedAt?: string;
  updated_at?: string;
}

interface V0ChatsListResponse {
  object?: string;
  data?: V0ChatRow[];
}

export const listRecent: ActionDescriptor<ListRecentParams, ListRecentResult> = {
  id: 'list-recent',
  supports,
  paramSchema: listRecentParamSchema,
  handler: async (params): Promise<ListRecentResult> => {
    const limit = Math.min(Math.max(params?.limit ?? 20, 1), 100);
    return withRetry(async () => {
      const client = createV0ApiClient();
      const resp = await client.get<V0ChatsListResponse>(`/v1/chats?limit=${limit}`);
      const items = resp.data ?? [];
      const components = items.map<ComponentSummary>((raw) => ({
        id: raw.id ?? '',
        title: raw.title ?? raw.name ?? '',
        updatedAt: raw.updatedAt ?? raw.updated_at ?? '',
      }));
      return { components };
    }, { attempts: 3, baseMs: 250 });
  },
};
