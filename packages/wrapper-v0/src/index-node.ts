/**
 * `@qontinui/wrapper-v0` — Node entry point.
 *
 * Defaults to the `api` transport. Callers who want the Playwright fallback
 * should import `registerHandlers` and `createTransport` directly — the
 * headless transport requires a `targetUrl` option this shell does not
 * provide, to keep the default cheap.
 */

import { config as loadDotenv } from 'dotenv';

// Auto-load credentials from `.env.local` then `.env` in cwd. Existing
// `process.env` values always win (override: false). Both calls silently
// no-op when the files don't exist.
loadDotenv({ path: '.env.local', override: false, quiet: true });
loadDotenv({ path: '.env', override: false, quiet: true });

import { createTransport } from '@qontinui/ui-bridge-wrapper';
import { registerHandlers } from './handlers.js';

const transport = createTransport({
  kind: 'api',
  appId: 'wrapper-v0',
  appName: 'v0',
});
const registration = registerHandlers(transport);

async function main(): Promise<void> {
  await transport.ready();
  process.stdout.write(
    `[wrapper-v0] ready (transport=api, registered=${registration.registered.join(',')}); press Ctrl+C to exit.\n`
  );

  const shutdown = async (signal: NodeJS.Signals): Promise<never> => {
    process.stdout.write(`[wrapper-v0] received ${signal}, closing transport...\n`);
    await transport.close();
    process.exit(0);
  };
  process.on('SIGINT', (s) => {
    void shutdown(s);
  });
  process.on('SIGTERM', (s) => {
    void shutdown(s);
  });
}

void main().catch((err: unknown) => {
  const msg = err instanceof Error ? (err.stack ?? err.message) : String(err);
  process.stderr.write(`[wrapper-v0] fatal: ${msg}\n`);
  process.exit(1);
});

export { transport, registration };
