/**
 * `@qontinui/_testing-harness`
 *
 * Lightweight helpers for testing wrapper handlers without spinning up a
 * real transport. Intentionally small: the only public surface is
 * `MockTransport` (implements `WrapperTransport`) and `createMockContext`
 * (builds a canned `ctx` object for a given transport kind).
 *
 * The harness is private and source-only (no build step); wrapper packages
 * list it under `devDependencies` and import from it directly.
 */

export {
  MockTransport,
  type MockTransportOptions,
  type MockDispatchCall,
} from './mock-transport.js';
export { createMockContext } from './mock-context.js';
