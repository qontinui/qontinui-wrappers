/**
 * `@qontinui/wrapper-v0` — Node entry point.
 *
 * Defaults to the `api` transport. Callers who want the Playwright fallback
 * should import `registerHandlers` and `createTransport` directly — the
 * headless transport requires a `targetUrl` option this shell does not
 * provide, to keep the default cheap.
 *
 * Supports `--manifest-only` for the runner's WrapperRegistry: prints a JSON
 * manifest envelope to stdout and exits without ever starting the WS server.
 */

import { config as loadDotenv } from 'dotenv';

// Auto-load credentials from `.env.local` then `.env` in cwd. Existing
// `process.env` values always win (override: false). Both calls silently
// no-op when the files don't exist.
loadDotenv({ path: '.env.local', override: false, quiet: true });
loadDotenv({ path: '.env', override: false, quiet: true });

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  createTransport,
  runWrapperEntrypoint,
  type WrapperManifest,
  type ManifestActionMeta,
} from '@qontinui/ui-bridge-wrapper';
import { registerHandlers, V0_ACTIONS } from './handlers.js';

/** Resolve and parse this package's `qontinui.wrapper` manifest. */
function loadManifest(): WrapperManifest {
  // import.meta.url points at dist/index-node.js after build (or src/index-node.ts in dev).
  // Either way, package.json lives one directory up.
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgPath = resolve(here, '..', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
    qontinui?: { wrapper?: WrapperManifest };
  };
  if (!pkg.qontinui?.wrapper) {
    throw new Error(`wrapper-v0: package.json at ${pkgPath} is missing qontinui.wrapper`);
  }
  return pkg.qontinui.wrapper;
}

const manifest = loadManifest();

const transport = createTransport({
  kind: 'api',
  appId: 'wrapper-v0',
  appName: 'v0',
});
const registration = registerHandlers(transport);

// Build manifest action metadata from the descriptors actually compatible
// with this transport. Keeps `--manifest-only` consistent with what the
// runner can dispatch at runtime.
const registeredIds = new Set(registration.registered);
const actions: ManifestActionMeta[] = V0_ACTIONS.filter((a) => registeredIds.has(a.id)).map(
  (a) => ({
    id: a.id,
    paramSchema: a.paramSchema,
    exclusive: a.exclusive ?? false,
  })
);

void runWrapperEntrypoint({
  transport,
  manifest,
  actions,
  logName: 'wrapper-v0',
}).catch((err: unknown) => {
  const msg = err instanceof Error ? (err.stack ?? err.message) : String(err);
  process.stderr.write(`[wrapper-v0] fatal: ${msg}\n`);
  process.exit(1);
});

export { transport, registration };
