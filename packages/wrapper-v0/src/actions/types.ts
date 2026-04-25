/**
 * Shared action types for the v0 wrapper.
 *
 * Declares which transport kinds each action supports so `handlers.ts` can
 * gate registration on the transport's `kind`. This prevents the silent
 * "action resolves on transport X but dispatches on transport Y throw" foot
 * gun.
 */

import type { WrapperTransportKind } from '@qontinui/ui-bridge-wrapper';

export type SupportedKinds = ReadonlyArray<WrapperTransportKind>;

export interface ActionDescriptor<TParams = unknown, TResult = unknown> {
  id: string;
  supports: SupportedKinds;
  paramSchema: Record<string, unknown>;
  handler: (params: TParams | undefined, ctx: unknown) => Promise<TResult>;
}
