/**
 * Action: `iterate-component`
 *
 * Posts a follow-up prompt to an existing component, producing a new
 * iteration. `api` transport only — the iterate endpoint is documented.
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
      const resp = await client.post<{ iterationId: string; id?: string }>(
        `/v1/components/${encodeURIComponent(componentId)}/iterations`,
        { prompt }
      );
      return { iterationId: resp.iterationId ?? resp.id ?? '' };
    }, { attempts: 3, baseMs: 250 });
  },
};
