import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.tsx',
    'index-node': 'src/index-node.ts',
    // The OAuth setup CLI ships as CommonJS only — it's invoked via the
    // `gmail-oauth-setup` bin entry, so a single Node-runnable artifact
    // (with the shebang preserved by tsup) is all we need. ESM here would
    // mean an extra file with no consumer.
    'scripts/oauth-setup': 'src/scripts/oauth-setup.ts',
  },
  format: ['cjs', 'esm'],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' };
  },
  // Preserve the `#!/usr/bin/env node` shebang on the CJS script output so
  // the file can be invoked directly via the bin shim that pnpm/npm
  // generate. tsup respects shebangs on CJS entries by default; this
  // option only matters if a future esbuild upgrade flips that.
  shims: false,
  external: [
    '@qontinui/ui-bridge',
    '@qontinui/ui-bridge-wrapper',
    '@qontinui/ui-bridge-headless',
    'googleapis',
    'react',
    'react-dom',
  ],
});
