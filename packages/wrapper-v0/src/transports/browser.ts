/**
 * Browser-driven (Playwright) helpers for v0.
 *
 * The `HeadlessTransport` / `HeadedTransport` open their own Chromium and
 * hand each action handler the `page` + `context`. This module is the
 * thin facade that action code uses to script v0.app — centralizing
 * selectors and wait logic keeps churn contained when v0 ships UI updates.
 */

import type { Page } from 'playwright';

export interface V0BrowserEnv {
  /** Base URL for v0.app (override for staging / preview). */
  baseUrl: string;
  /** Optional path to a signed-in `storageState.json`. */
  storageStatePath?: string;
}

export function readV0BrowserEnv(env: NodeJS.ProcessEnv = process.env): V0BrowserEnv {
  const baseUrl = env['V0_BASE_URL'] ?? 'https://v0.app';
  const storageStatePath = env['V0_STORAGE_STATE_PATH'];
  const out: V0BrowserEnv = { baseUrl };
  if (storageStatePath) out.storageStatePath = storageStatePath;
  return out;
}

export interface IterationSummary {
  iterationId: string;
  label: string;
  /** ISO8601 timestamp if visible on the UI, empty string otherwise. */
  createdAt: string;
}

export interface PreviewState {
  url: string;
  title: string;
  /** Size of the preview iframe in CSS pixels, or null if not detectable. */
  previewSize: { width: number; height: number } | null;
  /** Whether the preview surface is currently loading. */
  loading: boolean;
}

/**
 * Scrape the iteration list from the current v0.app workspace view.
 *
 * v0 UI selectors may change — verify against the current DOM when the
 * action fails. The selectors below are deliberately loose so a minor UI
 * tweak (class renames) does not break the full workflow.
 */
export async function scrapeIterationList(page: Page): Promise<IterationSummary[]> {
  const handles = await page.$$('[data-iteration-id], [data-testid*="iteration"]');
  const out: IterationSummary[] = [];
  for (const handle of handles) {
    const id =
      (await handle.getAttribute('data-iteration-id')) ??
      (await handle.getAttribute('data-testid')) ??
      '';
    const label = (await handle.textContent())?.trim() ?? '';
    const createdAt = (await handle.getAttribute('data-created-at')) ?? '';
    if (!id) continue;
    out.push({ iterationId: id, label, createdAt });
  }
  return out;
}

/** Read a snapshot of the preview area suitable for assertion. */
export async function readPreviewState(page: Page): Promise<PreviewState> {
  const url = page.url();
  const title = await page.title().catch(() => '');
  const preview = await page.$('iframe[title*="Preview" i], [data-testid="preview"]');
  let previewSize: PreviewState['previewSize'] = null;
  if (preview) {
    const box = await preview.boundingBox();
    if (box) previewSize = { width: Math.round(box.width), height: Math.round(box.height) };
  }
  const loading =
    (await page.$('[data-preview-state="loading"], [data-testid="preview-loading"]')) !== null;
  return { url, title, previewSize, loading };
}

/** Click through the iterations in order, returning each label encountered. */
export async function stepThroughIterations(page: Page, maxSteps: number): Promise<string[]> {
  const labels: string[] = [];
  for (let i = 0; i < maxSteps; i++) {
    const next = await page.$('[data-testid="iteration-next"], button[aria-label*="Next"]');
    if (!next) break;
    const isDisabled = await next.isDisabled();
    if (isDisabled) break;
    await next.click();
    // Short settle window; v0 updates the DOM in reaction to click.
    await page.waitForTimeout(250);
    const current = await page.$('[data-testid="iteration-current"], [aria-current="true"]');
    const label = (await current?.textContent())?.trim() ?? '';
    labels.push(label);
  }
  return labels;
}
