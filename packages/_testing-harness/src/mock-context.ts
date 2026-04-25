/**
 * `createMockContext`
 *
 * Returns a plausible-shaped context for a given transport kind so handler
 * code that narrows on `ctx.kind` can be exercised in tests without needing
 * a real Playwright page or WebSocket.
 *
 * The `headless`/`headed`/`live` contexts use stub objects — handler code
 * should prefer to mock the browser/network boundary at the module level
 * (e.g. `vi.mock('playwright')`), not rely on these stubs providing real
 * behavior.
 */

import type { WrapperTransportKind } from '@qontinui/ui-bridge-wrapper';

export function createMockContext(kind: WrapperTransportKind): unknown {
  switch (kind) {
    case 'api':
      return { kind: 'api' };
    case 'headless':
    case 'headed':
      return {
        kind,
        page: createStubPage(),
        browserContext: {},
        browser: {},
        uiBridgeRegistered: false,
        tabId: null,
      };
    case 'live':
      return { kind: 'live', commandId: null };
    default: {
      const exhaustive: never = kind;
      return { kind: exhaustive };
    }
  }
}

function createStubPage(): Record<string, unknown> {
  const noop = async (): Promise<void> => {};
  return {
    url: () => 'about:blank',
    goto: noop,
    click: noop,
    fill: noop,
    type: noop,
    waitForSelector: async () => null,
    evaluate: async () => undefined,
    content: async () => '<html></html>',
    close: noop,
  };
}
