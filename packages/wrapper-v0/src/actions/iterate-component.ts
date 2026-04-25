/**
 * Action: `iterate-component`
 *
 * Posts a follow-up prompt to an existing v0 chat, producing a new version.
 * v0's data model: each chat has many messages; sending a user message
 * triggers an assistant response and creates a new version snapshot
 * server-side. This wrapper preserves the historical `componentId` /
 * `iterationId` public names; internally `componentId === chatId` and
 * `iterationId === chat.latestVersion.id` after the message lands.
 *
 * Endpoints:
 *   POST /v1/chats/{chatId}/messages { message }  → MessageDetail
 *   GET  /v1/chats/{chatId}                       → ChatDetail (for new latestVersion.id)
 *
 * Two requests instead of one, but reliable: the message-detail response
 * shape isn't fully captured in our shapes doc, so re-fetching the chat to
 * read `latestVersion.id` is the safe portable path.
 *
 * v0 API surface may change — verify against their current docs.
 */

import { withRetry, paramSchemaOf } from '@qontinui/ui-bridge-wrapper';
import { createV0ApiClient } from '../transports/api.js';
import type { ActionDescriptor } from './types.js';

export interface IterateComponentParams {
  componentId: string;
  prompt: string;
}

export interface IterateComponentResult {
  iterationId: string;
}

export const iterateComponentParamSchema = paramSchemaOf({
  componentId: 'string',
  prompt: 'string',
});

const supports = ['api'] as const;

interface V0ChatDetailWithVersion {
  id?: string;
  latestVersion?: {
    id?: string;
  };
}

export const iterateComponent: ActionDescriptor<
  IterateComponentParams,
  IterateComponentResult
> = {
  id: 'iterate-component',
  supports,
  paramSchema: iterateComponentParamSchema,
  handler: async (params): Promise<IterateComponentResult> => {
    const componentId = params?.componentId;
    const prompt = params?.prompt;
    if (!componentId) throw new Error("iterate-component requires 'componentId'");
    if (!prompt) throw new Error("iterate-component requires 'prompt'");

    return withRetry(async () => {
      const client = createV0ApiClient();
      // 1) Send the follow-up message — server creates a new version as a side effect.
      await client.post<unknown>(
        `/v1/chats/${encodeURIComponent(componentId)}/messages`,
        { message: prompt }
      );
      // 2) Re-fetch chat detail to read the new latestVersion.id. Reliable
      // across response-shape variants of chats.sendMessage.
      const detail = await client.get<V0ChatDetailWithVersion>(
        `/v1/chats/${encodeURIComponent(componentId)}`
      );
      return { iterationId: detail.latestVersion?.id ?? '' };
    }, { attempts: 3, baseMs: 250 });
  },
};
