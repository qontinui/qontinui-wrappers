/**
 * Handler registration for `@qontinui/wrapper-v0`.
 *
 * Every action declares which transport kinds it supports. At registration
 * time we filter the action list against `transport.kind` and only register
 * the compatible ones — an action attempted against an unsupported transport
 * would throw `NO_HANDLER` at dispatch time, which is preferable to a silent
 * "this action's handler assumed a browser page but got an api ctx" crash.
 */

import type { WrapperTransport, WrapperTransportKind } from '@qontinui/ui-bridge-wrapper';
import { createComponent } from './actions/create-component.js';
import { iterateComponent } from './actions/iterate-component.js';
import { exportCode } from './actions/export-code.js';
import { listRecent } from './actions/list-recent.js';
import { stepThroughIterations } from './actions/step-through-iterations.js';
import { inspectPreviewState } from './actions/inspect-preview-state.js';
import type { ActionDescriptor } from './actions/types.js';

export const V0_ACTIONS: ReadonlyArray<ActionDescriptor<unknown, unknown>> = [
  createComponent as ActionDescriptor<unknown, unknown>,
  iterateComponent as ActionDescriptor<unknown, unknown>,
  exportCode as ActionDescriptor<unknown, unknown>,
  listRecent as ActionDescriptor<unknown, unknown>,
  stepThroughIterations as ActionDescriptor<unknown, unknown>,
  inspectPreviewState as ActionDescriptor<unknown, unknown>,
];

export interface RegisterHandlersResult {
  registered: string[];
  skipped: Array<{ id: string; reason: string }>;
}

export function registerHandlers(transport: WrapperTransport): RegisterHandlersResult {
  const registered: string[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];
  const kind: WrapperTransportKind = transport.kind;

  for (const action of V0_ACTIONS) {
    if (!action.supports.includes(kind)) {
      skipped.push({
        id: action.id,
        reason: `transport '${kind}' not in supports=[${action.supports.join(',')}]`,
      });
      continue;
    }
    transport.register(action.id, action.handler);
    registered.push(action.id);
  }
  return { registered, skipped };
}

/** Action ids grouped by their supported transports (handy for the React UI). */
export const V0_ACTION_IDS = V0_ACTIONS.map((a) => a.id);
