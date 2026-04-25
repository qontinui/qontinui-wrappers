/**
 * Action: `download-component`
 *
 * Downloads a v0 chat version as a single archive blob (zip or gzip),
 * complementing `export-code` which returns per-file content. Useful when
 * callers want a self-contained artifact to write to disk, attach to a CI
 * job, or pass to a packaging step.
 *
 * Endpoint: GET /v1/chats/{chatId}/versions/{versionId}/download
 *           (operationId `chats.downloadVersion`)
 *
 * Per OpenAPI the response is `application/zip` or `application/gzip` —
 * binary, not JSON. We bypass the typed client here and fetch directly so
 * `transports/api.ts` stays JSON-only. The bytes are base64-encoded for
 * the JSON-serializable wrapper return value (33% inflation, fine for
 * typical generated component archives in the tens-of-KB range).
 *
 * Public contract:
 *   - `componentId` is the chat id (preserved for parity with sibling actions)
 *   - `iterationId` is the version id; if absent we fall back to chat.latestVersion.id
 *   - `format` chooses the Accept header; default is "zip"
 *
 * Returns `{ format, byteLength, base64 }`. Caller decodes when needed:
 *   const buf = Buffer.from(result.base64, 'base64');
 *   fs.writeFileSync(`${componentId}.zip`, buf);
 */

import { withRetry, paramSchemaOf } from '@qontinui/ui-bridge-wrapper';
import { createV0ApiClient } from '../transports/api.js';
import { buildAuthHeaders, readV0AuthConfig } from '../auth.js';
import type { ActionDescriptor } from './types.js';

export type DownloadFormat = 'zip' | 'gzip';

export interface DownloadComponentParams {
  componentId: string;
  iterationId?: string;
  format?: DownloadFormat;
}

export interface DownloadComponentResult {
  format: DownloadFormat;
  byteLength: number;
  base64: string;
}

export const downloadComponentParamSchema = paramSchemaOf({
  componentId: 'string',
  iterationId: { type: 'string', optional: true },
  format: { type: 'string', optional: true },
});

const supports = ['api'] as const;

interface V0ChatDetailWithVersion {
  id?: string;
  latestVersion?: { id?: string };
}

const ACCEPT_BY_FORMAT: Record<DownloadFormat, string> = {
  zip: 'application/zip',
  gzip: 'application/gzip',
};

export const downloadComponent: ActionDescriptor<
  DownloadComponentParams,
  DownloadComponentResult
> = {
  id: 'download-component',
  supports,
  paramSchema: downloadComponentParamSchema,
  handler: async (params): Promise<DownloadComponentResult> => {
    const componentId = params?.componentId;
    if (!componentId) throw new Error("download-component requires 'componentId'");
    const format: DownloadFormat = params?.format === 'gzip' ? 'gzip' : 'zip';

    return withRetry(async () => {
      // Resolve versionId — explicit param wins; else chat detail's latestVersion.
      let versionId = params?.iterationId;
      if (!versionId) {
        const client = createV0ApiClient();
        const detail = await client.get<V0ChatDetailWithVersion>(
          `/v1/chats/${encodeURIComponent(componentId)}`
        );
        versionId = detail.latestVersion?.id;
        if (!versionId) {
          throw new Error(
            "download-component: chat has no latestVersion to download; pass 'iterationId' explicitly"
          );
        }
      }

      // Binary fetch — bypasses the JSON-only typed client.
      const auth = readV0AuthConfig();
      const headers = {
        ...buildAuthHeaders(auth),
        Accept: ACCEPT_BY_FORMAT[format],
      };
      // The auth-headers helper sets Content-Type: application/json which is
      // irrelevant for a GET with no body; harmless to leave.
      const url = `${auth.apiBaseUrl}/v1/chats/${encodeURIComponent(componentId)}/versions/${encodeURIComponent(versionId)}/download`;
      const resp = await fetch(url, { method: 'GET', headers });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(
          `v0 api error ${resp.status} ${resp.statusText} for GET ${url}: ${text.slice(0, 256)}`
        );
      }
      const buf = await resp.arrayBuffer();
      const bytes = new Uint8Array(buf);
      // Node 18+ Buffer; works in any Node runtime the wrapper supports.
      const base64 = Buffer.from(bytes).toString('base64');
      return {
        format,
        byteLength: bytes.byteLength,
        base64,
      };
    }, { attempts: 3, baseMs: 250 });
  },
};
