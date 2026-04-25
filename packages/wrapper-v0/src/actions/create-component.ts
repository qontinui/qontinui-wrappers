/**
 * Action: `create-component`
 *
 * Creates a new v0 chat from a natural-language prompt. v0's data model is
 * built around chats (a generation conversation that produces version
 * snapshots). This wrapper preserves the historical `componentId` public
 * parameter name; internally `componentId === chatId` and the action POSTs
 * to v0's `chats.create` endpoint. The historical `framework` parameter has
 * no direct v0 equivalent — it would need to be inlined into a `system`
 * hint, which would misrepresent the API capability — so it is silently
 * ignored if passed (preserves backward compat without surprising callers).
 *
 * Endpoint: POST /v1/chats { message: <prompt>, ... } → ChatDetail
 *
 * v0 API surface may change — verify against their current docs.
 */

import { withRetry, paramSchemaOf } from '@qontinui/ui-bridge-wrapper';
import type { Page } from 'playwright';
import { createV0ApiClient } from '../transports/api.js';
import type { ActionDescriptor } from './types.js';

export interface CreateComponentParams {
  prompt: string;
  /** Optional project id to associate the chat with. */
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

interface V0ChatDetailResponse {
  id?: string;
  webUrl?: string;
  url?: string;
}

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
        // Map wrapper params → v0 chats.create body. `responseMode: 'sync'`
        // is the default; explicit here for clarity. `framework` (legacy
        // wrapper param) has no direct v0 field — silently dropped.
        const body: Record<string, unknown> = {
          message: prompt,
          responseMode: 'sync',
        };
        if (params?.projectId) body['projectId'] = params.projectId;
        const resp = await client.post<V0ChatDetailResponse>('/v1/chats', body);
        const result: CreateComponentResult = { componentId: resp.id ?? '' };
        const url = resp.webUrl ?? resp.url;
        if (url) result.url = url;
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
