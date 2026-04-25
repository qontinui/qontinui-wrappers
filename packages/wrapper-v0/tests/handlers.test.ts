/**
 * Tests that `registerHandlers` routes actions correctly based on the
 * transport kind, only registering compatible actions.
 */

import { describe, expect, it } from 'vitest';
import { MockTransport } from '@qontinui/_testing-harness';
import { registerHandlers, V0_ACTIONS } from '../src/handlers.js';

describe('registerHandlers (v0)', () => {
  it('registers api-only + api-compatible actions on an api transport', () => {
    const transport = new MockTransport({ kind: 'api' });
    const result = registerHandlers(transport);

    expect(result.registered).toEqual(
      expect.arrayContaining([
        'create-component',
        'iterate-component',
        'export-code',
        'list-recent',
      ])
    );
    expect(result.registered).not.toContain('step-through-iterations');
    expect(result.registered).not.toContain('inspect-preview-state');

    expect(result.skipped.map((s) => s.id).sort()).toEqual([
      'inspect-preview-state',
      'step-through-iterations',
    ]);
  });

  it('registers browser-only + shared actions on a headless transport', () => {
    const transport = new MockTransport({ kind: 'headless' });
    const result = registerHandlers(transport);

    expect(result.registered).toEqual(
      expect.arrayContaining([
        'create-component',
        'step-through-iterations',
        'inspect-preview-state',
      ])
    );
    expect(result.registered).not.toContain('iterate-component');
    expect(result.registered).not.toContain('export-code');
    expect(result.registered).not.toContain('list-recent');
  });

  it('every action declares at least one supported transport', () => {
    for (const action of V0_ACTIONS) {
      expect(action.supports.length).toBeGreaterThan(0);
    }
  });
});
