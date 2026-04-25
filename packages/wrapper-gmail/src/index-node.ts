/**
 * `@qontinui/wrapper-gmail` — Node entry point.
 *
 * Spins up a single `api` transport, registers the Gmail handlers, and
 * parks the event loop until SIGINT/SIGTERM. Useful as a daemon sidecar
 * or a CI probe. Deliberately does not import React.
 */

import { config as loadDotenv } from 'dotenv';

// Auto-load credentials from `.env.local` then `.env` in cwd. Existing
// `process.env` values always win (override: false). Both calls silently
// no-op when the files don't exist, so this is safe in CI / containers
// where credentials are injected directly as env vars.
loadDotenv({ path: '.env.local', override: false, quiet: true });
loadDotenv({ path: '.env', override: false, quiet: true });

import { createTransport } from '@qontinui/ui-bridge-wrapper';
import { registerHandlers } from './handlers.js';

const transport = createTransport({
  kind: 'api',
  appId: 'wrapper-gmail',
  appName: 'Gmail',
});
registerHandlers(transport);

async function main(): Promise<void> {
  await transport.ready();
  process.stdout.write('[wrapper-gmail] ready (transport=api); press Ctrl+C to exit.\n');

  const shutdown = async (signal: NodeJS.Signals): Promise<never> => {
    process.stdout.write(`[wrapper-gmail] received ${signal}, closing transport...\n`);
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
  process.stderr.write(`[wrapper-gmail] fatal: ${msg}\n`);
  process.exit(1);
});

export { transport };
