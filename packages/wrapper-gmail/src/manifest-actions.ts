/**
 * Lightweight action metadata for `--manifest-only` mode.
 *
 * Re-declares the paramSchemas next to the action ids so the manifest-only
 * code path does not need to import the action handler files (which transitively
 * pull in `googleapis` — ~450ms of cold startup we want to avoid for cheap
 * discovery). The schemas are kept identical to the per-action `*ParamSchema`
 * exports, and a vitest test enforces parity to prevent drift.
 */

import { paramSchemaOf, type ManifestActionMeta } from '@qontinui/ui-bridge-wrapper';

export const GMAIL_MANIFEST_ACTIONS: ReadonlyArray<ManifestActionMeta> = [
  {
    id: 'list-unread',
    paramSchema: paramSchemaOf({
      limit: { type: 'number', optional: true },
      query: { type: 'string', optional: true },
    }),
  },
  {
    id: 'search',
    paramSchema: paramSchemaOf({
      query: 'string',
      limit: { type: 'number', optional: true },
    }),
  },
  {
    id: 'get-thread',
    paramSchema: paramSchemaOf({
      threadId: 'string',
    }),
  },
  {
    id: 'send-reply',
    paramSchema: paramSchemaOf({
      threadId: 'string',
      body: 'string',
    }),
  },
  {
    id: 'archive',
    paramSchema: paramSchemaOf({
      messageId: 'string',
    }),
  },
];
