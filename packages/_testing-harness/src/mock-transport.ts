/**
 * `MockTransport`
 *
 * Implements `WrapperTransport` without any real I/O. Test code registers
 * handlers on it (or supplies `cannedResponses`) and asserts on the call log
 * that `dispatch` produces.
 */

import {
  HandlerRegistry,
  WrapperTransportError,
  type WrapperHandler,
  type WrapperTransport,
  type WrapperTransportKind,
  type WrapperTransportStatus,
} from '@qontinui/ui-bridge-wrapper';
import { createMockContext } from './mock-context.js';

/** Configuration options for `MockTransport`. */
export interface MockTransportOptions {
  /** Transport kind to report. Defaults to `"api"`. */
  kind?: WrapperTransportKind;
  /**
   * Optional canned responses keyed by `actionId`. If a handler is not
   * explicitly registered, the canned response wins and the call is still
   * recorded in the log.
   *
   * A function value is invoked with `(params, ctx)`; a plain value is
   * returned as-is.
   */
  cannedResponses?: Record<string, unknown | ((params: unknown, ctx: unknown) => unknown)>;
  /** Context override; defaults to `createMockContext(kind)`. */
  context?: unknown;
}

/** A single recorded `dispatch` call. */
export interface MockDispatchCall {
  actionId: string;
  params: unknown;
  /** When the call resolved (ms since epoch). */
  at: number;
}

/**
 * Test double that satisfies the full `WrapperTransport` contract. Safe to
 * pass anywhere a real transport would be — handler registration, status
 * subscription, dispatch all behave sensibly.
 */
export class MockTransport implements WrapperTransport {
  readonly kind: WrapperTransportKind;
  private _status: WrapperTransportStatus = 'idle';
  private readonly registry = new HandlerRegistry();
  private readonly listeners = new Set<(s: WrapperTransportStatus) => void>();
  private readonly canned: MockTransportOptions['cannedResponses'];
  private readonly context: unknown;

  /** Log of every `dispatch()` invocation in insertion order. */
  readonly calls: MockDispatchCall[] = [];

  constructor(options: MockTransportOptions = {}) {
    this.kind = options.kind ?? 'api';
    this.canned = options.cannedResponses;
    this.context = options.context ?? createMockContext(this.kind);
  }

  get status(): WrapperTransportStatus {
    return this._status;
  }

  get handlerRegistry(): HandlerRegistry {
    return this.registry;
  }

  register<TParams = unknown, TResult = unknown, TCtx = unknown>(
    actionId: string,
    fn: WrapperHandler<TParams, TResult, TCtx>
  ): void {
    this.registry.register(actionId, fn);
  }

  async ready(): Promise<void> {
    if (this._status === 'closed') {
      throw new WrapperTransportError('TRANSPORT_CLOSED', 'MockTransport is closed');
    }
    this.setStatus('ready');
  }

  async dispatch<TResult = unknown>(actionId: string, params?: unknown): Promise<TResult> {
    await this.ready();
    this.calls.push({ actionId, params, at: Date.now() });

    if (this.registry.has(actionId)) {
      return this.registry.dispatch<TResult>(actionId, params, this.context);
    }

    if (this.canned && Object.prototype.hasOwnProperty.call(this.canned, actionId)) {
      const entry = this.canned[actionId];
      if (typeof entry === 'function') {
        const fn = entry as (p: unknown, c: unknown) => unknown;
        return (await fn(params, this.context)) as TResult;
      }
      return entry as TResult;
    }

    throw new WrapperTransportError(
      'NO_HANDLER',
      `MockTransport has no handler or canned response for '${actionId}'`
    );
  }

  async close(): Promise<void> {
    this.setStatus('closed');
    this.listeners.clear();
  }

  onStatusChange(listener: (s: WrapperTransportStatus) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Clear the call log without altering handler registrations. */
  resetCalls(): void {
    this.calls.length = 0;
  }

  private setStatus(next: WrapperTransportStatus): void {
    if (this._status === next) return;
    this._status = next;
    for (const l of this.listeners) {
      try {
        l(next);
      } catch {
        // Listener errors must not affect mock state.
      }
    }
  }
}
