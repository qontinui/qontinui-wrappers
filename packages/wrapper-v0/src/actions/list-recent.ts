/**
 * Action: `list-recent`
 *
 * Returns a page of the authenticated user's recent components.
 *
 * v0 API surface may change — verify against their current docs.
 */

import { withRetry, paramSchemaOf } from '@qontinui/ui-bridge-wrapper';
import { createV0ApiClient } from '../transports/api.js';
import type { ActionDescriptor } from './types.js';

export interface ListRecentParams {
  limit?: number;
}

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

export const listRecent: ActionDescriptor<ListRecentParams, ListRecentResult> = {
  id: 'list-recent',
  supports,
  paramSchema: listRecentParamSchema,
  handler: async (params): Promise<ListRecentResult> => {
    const limit = Math.min(Math.max(params?.limit ?? 20, 1), 100);
    return withRetry(async () => {
      const client = createV0ApiClient();
      const resp = await client.get<{ components?: unknown[] }>(
        `/v1/components?limit=${limit}`
      );
      const items = (resp.components ?? []) as Array<{
        id?: string;
        title?: string;
        name?: string;
        updatedAt?: string;
        updated_at?: string;
      }>;
      const components = items.map<ComponentSummary>((raw) => ({
        id: raw.id ?? '',
        title: raw.title ?? raw.name ?? '',
        updatedAt: raw.updatedAt ?? raw.updated_at ?? '',
      }));
      return { components };
    }, { attempts: 3, baseMs: 250 });
  },
};
