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
 * Endpoint: POST /v1/chats/{chatId}/messages { message }  → ChatDetail
 *
 * Verified against v0's OpenAPI spec (`/v1/openapi.json`,
 * `chats.sendMessage` operation): the success response is the full
 * `ChatDetail` schema, not just a MessageDetail. That means the new
 * version produced as a side-effect of the message is already on
 * `latestVersion.id` in the response — no follow-up GET needed.
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
      // POST returns ChatDetail (per OpenAPI), so latestVersion.id is on
      // this single response. No follow-up GET needed.
      const detail = await client.post<V0ChatDetailWithVersion>(
        `/v1/chats/${encodeURIComponent(componentId)}/messages`,
        { message: prompt }
      );
      return { iterationId: detail.latestVersion?.id ?? '' };
    }, { attempts: 3, baseMs: 250 });
  },
};
