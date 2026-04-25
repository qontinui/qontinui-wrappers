/**
 * `@qontinui/wrapper-gmail` — Node entry point.
 *
 * Spins up a single `api` transport, registers the Gmail handlers, and
 * parks the event loop until SIGINT/SIGTERM. Useful as a daemon sidecar
 * or a CI probe. Deliberately does not import React.
 *
 * Supports `--manifest-only` for the runner's WrapperRegistry: prints a JSON
 * manifest envelope to stdout and exits without ever starting the WS server.
 * That fast path skips importing `./handlers.js` so we don't pay the
 * `googleapis` cold-import cost (~450ms) just to enumerate action schemas.
 */

import { config as loadDotenv } from 'dotenv';

// Auto-load credentials from `.env.local` then `.env` in cwd. Existing
// `process.env` values always win (override: false). Both calls silently
// no-op when the files don't exist, so this is safe in CI / containers
// where credentials are injected directly as env vars.
loadDotenv({ path: '.env.local', override: false, quiet: true });
loadDotenv({ path: '.env', override: false, quiet: true });

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  createTransport,
  emitManifestOnly,
  runWrapperEntrypoint,
  type WrapperManifest,
} from '@qontinui/ui-bridge-wrapper';
import { GMAIL_MANIFEST_ACTIONS } from './manifest-actions.js';

/** Resolve and parse this package's `qontinui.wrapper` manifest. */
function loadManifest(): WrapperManifest {
  // import.meta.url points at dist/index-node.js after build. package.json lives one dir up.
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgPath = resolve(here, '..', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
    qontinui?: { wrapper?: WrapperManifest };
  };
  if (!pkg.qontinui?.wrapper) {
    throw new Error(`wrapper-gmail: package.json at ${pkgPath} is missing qontinui.wrapper`);
  }
  return pkg.qontinui.wrapper;
}

const manifest = loadManifest();

const transport = createTransport({
  kind: 'api',
  appId: 'wrapper-gmail',
  appName: 'Gmail',
});

async function main(): Promise<never> {
  if (process.argv.slice(2).includes('--manifest-only')) {
    // Short-circuit: do not import `./handlers.js` (which transitively imports
    // googleapis). Emit the manifest from the lightweight metadata and exit.
    await emitManifestOnly({
      transport,
      manifest,
      actions: GMAIL_MANIFEST_ACTIONS,
    });
    throw new Error('unreachable');
  }

  // Normal daemon path: import handlers (which pull in googleapis), register
  // them, and run the standard wait-for-signal loop.
  const { registerHandlers } = await import('./handlers.js');
  registerHandlers(transport);

  return runWrapperEntrypoint({
    transport,
    manifest,
    actions: GMAIL_MANIFEST_ACTIONS,
    logName: 'wrapper-gmail',
  });
}

void main().catch((err: unknown) => {
  const msg = err instanceof Error ? (err.stack ?? err.message) : String(err);
  process.stderr.write(`[wrapper-gmail] fatal: ${msg}\n`);
  process.exit(1);
});

export { transport };
