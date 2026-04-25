/**
 * Action: `step-through-iterations`
 *
 * Browser-only. Clicks the "next iteration" control repeatedly and records
 * each label reached, up to `maxSteps`. Useful for visual regression
 * walkthroughs that need to land on each iteration in order.
 */

import { paramSchemaOf } from '@qontinui/ui-bridge-wrapper';
import type { Page } from 'playwright';
import { stepThroughIterations as runStep } from '../transports/browser.js';
import type { ActionDescriptor } from './types.js';

export interface StepThroughIterationsParams {
  maxSteps?: number;
}

export interface StepThroughIterationsResult {
  labels: string[];
}

export const stepThroughIterationsParamSchema = paramSchemaOf({
  maxSteps: { type: 'number', optional: true },
});

const supports = ['headless', 'headed'] as const;

export const stepThroughIterations: ActionDescriptor<
  StepThroughIterationsParams,
  StepThroughIterationsResult
> = {
  id: 'step-through-iterations',
  supports,
  paramSchema: stepThroughIterationsParamSchema,
  handler: async (params, ctx): Promise<StepThroughIterationsResult> => {
    const page = (ctx as { page?: Page })?.page;
    if (!page) {
      throw new Error('step-through-iterations requires a browser transport');
    }
    const maxSteps = Math.min(Math.max(params?.maxSteps ?? 10, 1), 50);
    const labels = await runStep(page, maxSteps);
    return { labels };
  },
};
