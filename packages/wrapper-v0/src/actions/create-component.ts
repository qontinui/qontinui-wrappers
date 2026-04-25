/**
 * Action: `create-component`
 *
 * Creates a new v0 component from a natural-language prompt. Supports both
 * transports — the `api` path POSTs to the v0 REST endpoint; the browser
 * path drives the UI's prompt box as a fallback.
 *
 * v0 API surface may change — verify against their current docs.
 */

import { withRetry, paramSchemaOf } from '@qontinui/ui-bridge-wrapper';
import type { Page } from 'playwright';
import { createV0ApiClient } from '../transports/api.js';
import type { ActionDescriptor } from './types.js';

export interface CreateComponentParams {
  prompt: string;
  /** Optional project id to associate the component with. */
  projectId?: string;
}

export interface CreateComponentResult {
  componentId: string;
  url?: string;
}

export const createComponentParamSchema = paramSchemaOf({
  prompt: 'string',
  projectId: { type: 'string', optional: true },
});

const supports = ['api', 'headless', 'headed'] as const;

export const createComponent: ActionDescriptor<
  CreateComponentParams,
  CreateComponentResult
> = {
  id: 'create-component',
  supports,
  paramSchema: createComponentParamSchema,
  handler: async (params, ctx): Promise<CreateComponentResult> => {
    const prompt = params?.prompt;
    if (!prompt) throw new Error("create-component requires a 'prompt' string");

    const kind = (ctx as { kind?: string } | undefined)?.kind;

    if (kind === 'api') {
      return withRetry(async () => {
        const client = createV0ApiClient();
        // v0 API surface may change — verify against their current docs.
        const body: Record<string, unknown> = { prompt };
        if (params?.projectId) body['projectId'] = params.projectId;
        const resp = await client.post<{ id: string; url?: string }>('/v1/components', body);
        const result: CreateComponentResult = { componentId: resp.id };
        if (resp.url) result.url = resp.url;
        return result;
      }, { attempts: 3, baseMs: 250 });
    }

    if (kind === 'headless' || kind === 'headed') {
      const page = (ctx as { page: Page }).page;
      // Prompt UI selectors may change — centralize in transports/browser.ts
      // when we add more browser actions that need them.
      const input = await page.waitForSelector(
        'textarea[placeholder*="Create" i], textarea[data-testid="prompt-input"]'
      );
      await input.fill(prompt);
      await page.keyboard.press('Enter');
      await page.waitForURL(/\/r\//, { timeout: 30_000 });
      const url = page.url();
      const match = url.match(/\/r\/([^/?#]+)/);
      return { componentId: match?.[1] ?? '', url };
    }

    throw new Error(`create-component: unsupported transport kind '${kind ?? 'unknown'}'`);
  },
};
