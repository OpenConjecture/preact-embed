import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    signals: 'src/signals.ts',
    lite: 'src/lite.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: true,
  treeshake: true,
  splitting: false,
  external: ['preact', 'preact/hooks', '@preact/signals'],
  esbuildOptions(options) {
    options.jsx = 'automatic';
    options.jsxImportSource = 'preact';
  },
  banner: {
    js: '/* preact-embed | MIT License */',
  },
});
