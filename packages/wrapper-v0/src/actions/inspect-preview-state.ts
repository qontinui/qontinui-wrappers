/**
 * Action: `inspect-preview-state`
 *
 * Browser-only. Reads a structured snapshot of the v0.app preview surface —
 * URL, title, preview-pane size, loading flag. Returned data shape is
 * stable across v0 UI churn because `transports/browser.ts` centralises
 * the selectors.
 */

import { paramSchemaOf } from '@qontinui/ui-bridge-wrapper';
import type { Page } from 'playwright';
import { readPreviewState, type PreviewState } from '../transports/browser.js';
import type { ActionDescriptor } from './types.js';

export type InspectPreviewStateParams = Record<string, never>;
export type InspectPreviewStateResult = PreviewState;

export const inspectPreviewStateParamSchema = paramSchemaOf({});

const supports = ['headless', 'headed'] as const;

export const inspectPreviewState: ActionDescriptor<
  InspectPreviewStateParams,
  InspectPreviewStateResult
> = {
  id: 'inspect-preview-state',
  supports,
  paramSchema: inspectPreviewStateParamSchema,
  handler: async (_params, ctx): Promise<InspectPreviewStateResult> => {
    const page = (ctx as { page?: Page })?.page;
    if (!page) {
      throw new Error('inspect-preview-state requires a browser transport');
    }
    return readPreviewState(page);
  },
};
