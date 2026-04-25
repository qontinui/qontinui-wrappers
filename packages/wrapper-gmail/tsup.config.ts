import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.tsx',
    'index-node': 'src/index-node.ts',
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
  external: [
    '@qontinui/ui-bridge',
    '@qontinui/ui-bridge-wrapper',
    '@qontinui/ui-bridge-headless',
    'googleapis',
    'react',
    'react-dom',
  ],
});
