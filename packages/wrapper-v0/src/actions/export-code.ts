/**
 * Action: `export-code`
 *
 * Fetches the generated source code for a component (or specific iteration)
 * as a map of `path -> contents`. `api` transport only.
 *
 * v0 API surface may change — verify against their current docs.
 */

import { withRetry, paramSchemaOf } from '@qontinui/ui-bridge-wrapper';
import { createV0ApiClient } from '../transports/api.js';
import type { ActionDescriptor } from './types.js';

export interface ExportCodeParams {
  componentId: string;
  iterationId?: string;
}

export interface ExportCodeResult {
  files: Record<string, string>;
}

export const exportCodeParamSchema = paramSchemaOf({
  componentId: 'string',
  iterationId: { type: 'string', optional: true },
});

const supports = ['api'] as const;

export const exportCode: ActionDescriptor<ExportCodeParams, ExportCodeResult> = {
  id: 'export-code',
  supports,
  paramSchema: exportCodeParamSchema,
  handler: async (params): Promise<ExportCodeResult> => {
    const componentId = params?.componentId;
    if (!componentId) throw new Error("export-code requires 'componentId'");
    const path = params?.iterationId
      ? `/v1/components/${encodeURIComponent(componentId)}/iterations/${encodeURIComponent(params.iterationId)}/export`
      : `/v1/components/${encodeURIComponent(componentId)}/export`;

    return withRetry(async () => {
      const client = createV0ApiClient();
      const resp = await client.get<{ files?: Record<string, string> }>(path);
      return { files: resp.files ?? {} };
    }, { attempts: 3, baseMs: 250 });
  },
};
