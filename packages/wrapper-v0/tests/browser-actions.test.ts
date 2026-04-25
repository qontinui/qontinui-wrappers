/**
 * Tests for the browser-transport actions.
 *
 * We fake a Playwright-ish `page` object by hand — the actions only touch
 * a small surface (`$`, `$$`, `waitForSelector`, `click`, `textContent`).
 * No real `playwright` import is resolved at runtime in these tests because
 * the action modules import from `../src/transports/browser.js`, which is
 * type-only against playwright.
 */

import { describe, expect, it, vi } from 'vitest';
import type { Page } from 'playwright';

function makeFakePage(overrides: Partial<Record<keyof Page, unknown>> = {}): Page {
  const fake: Record<string, unknown> = {
    url: () => 'https://v0.app/r/abc',
    title: async () => 'abc — v0',
    $: vi.fn(async () => null),
    $$: vi.fn(async () => []),
    waitForSelector: vi.fn(async () => ({
      fill: vi.fn(async () => {}),
    })),
    keyboard: { press: vi.fn(async () => {}) },
    waitForURL: vi.fn(async () => {}),
    waitForTimeout: vi.fn(async () => {}),
    ...overrides,
  };
  return fake as unknown as Page;
}

describe('step-through-iterations', () => {
  it('stops when no next button is found', async () => {
    const { stepThroughIterations } = await import(
      '../src/actions/step-through-iterations.js'
    );
    const page = makeFakePage({
      $: vi.fn(async () => null) as unknown as Page['$'],
    });
    const result = await stepThroughIterations.handler(
      { maxSteps: 5 },
      { kind: 'headless', page }
    );
    expect(result.labels).toEqual([]);
  });

  it('clicks forward until the button is disabled', async () => {
    const { stepThroughIterations } = await import(
      '../src/actions/step-through-iterations.js'
    );

    // Next button alternates between "enabled" and "disabled".
    let step = 0;
    const currentLabels = ['Iteration 1', 'Iteration 2'];
    const dollarSign = vi.fn(async (sel: string) => {
      if (sel.includes('iteration-next') || sel.includes('Next')) {
        if (step < 2) {
          step += 1;
          return {
            isDisabled: async () => false,
            click: async () => {},
          };
        }
        return {
          isDisabled: async () => true,
          click: async () => {},
        };
      }
      if (sel.includes('iteration-current') || sel.includes('aria-current')) {
        return {
          textContent: async () => currentLabels[step - 1] ?? '',
        };
      }
      return null;
    });
    const page = makeFakePage({
      $: dollarSign as unknown as Page['$'],
    });
    const result = await stepThroughIterations.handler(
      { maxSteps: 5 },
      { kind: 'headed', page }
    );
    expect(result.labels).toEqual(['Iteration 1', 'Iteration 2']);
  });

  it('requires a browser transport context', async () => {
    const { stepThroughIterations } = await import(
      '../src/actions/step-through-iterations.js'
    );
    await expect(
      stepThroughIterations.handler({ maxSteps: 3 }, { kind: 'api' })
    ).rejects.toThrow(/browser transport/);
  });
});

describe('inspect-preview-state', () => {
  it('returns a snapshot with url + preview iframe info', async () => {
    const { inspectPreviewState } = await import(
      '../src/actions/inspect-preview-state.js'
    );
    const page = makeFakePage({
      $: vi.fn(async (sel: string) => {
        if (sel.includes('iframe')) {
          return {
            boundingBox: async () => ({ x: 0, y: 0, width: 1024, height: 768 }),
          };
        }
        return null;
      }) as unknown as Page['$'],
    });
    const result = await inspectPreviewState.handler({}, { kind: 'headless', page });
    expect(result).toEqual({
      url: 'https://v0.app/r/abc',
      title: 'abc — v0',
      previewSize: { width: 1024, height: 768 },
      loading: false,
    });
  });
});
