/**
 * Action: `export-code`
 *
 * Fetches the generated source files for a v0 chat version as a map of
 * `path -> contents`. v0's data model: each chat has versions; each
 * version exposes its files inline at `version.files[]`. There is no
 * separate `/files` subresource (404). This wrapper preserves the
 * historical `componentId` / `iterationId` public names; internally
 * `componentId === chatId` and `iterationId === versionId`. When
 * `iterationId` is omitted, the wrapper fetches chat detail first and uses
 * `chat.latestVersion.id`.
 *
 * Endpoints:
 *   GET /v1/chats/{chatId}                          → ChatDetail (when no iterationId)
 *   GET /v1/chats/{chatId}/versions/{versionId}     → VersionDetail with files[]
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

interface V0VersionFile {
  object?: string;
  name?: string;
  content?: string;
  locked?: boolean;
}

interface V0VersionDetailResponse {
  id?: string;
  object?: string;
  files?: V0VersionFile[];
}

interface V0ChatDetailForExport {
  id?: string;
  latestVersion?: {
    id?: string;
  };
}

export const exportCode: ActionDescriptor<ExportCodeParams, ExportCodeResult> = {
  id: 'export-code',
  supports,
  paramSchema: exportCodeParamSchema,
  handler: async (params): Promise<ExportCodeResult> => {
    const componentId = params?.componentId;
    if (!componentId) throw new Error("export-code requires 'componentId'");

    return withRetry(async () => {
      const client = createV0ApiClient();
      let versionId = params?.iterationId;
      if (!versionId) {
        // Fetch chat detail to discover the latest version id.
        const detail = await client.get<V0ChatDetailForExport>(
          `/v1/chats/${encodeURIComponent(componentId)}`
        );
        versionId = detail.latestVersion?.id;
        if (!versionId) {
          throw new Error(
            `export-code: chat '${componentId}' has no latestVersion to export`
          );
        }
      }
      const resp = await client.get<V0VersionDetailResponse>(
        `/v1/chats/${encodeURIComponent(componentId)}/versions/${encodeURIComponent(versionId)}`
      );
      const files: Record<string, string> = {};
      for (const f of resp.files ?? []) {
        if (f.name && typeof f.content === 'string') {
          files[f.name] = f.content;
        }
      }
      return { files };
    }, { attempts: 3, baseMs: 250 });
  },
};
