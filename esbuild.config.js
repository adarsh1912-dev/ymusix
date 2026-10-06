import { build } from 'esbuild';
import { chmod, mkdir } from 'node:fs/promises';

const watch = process.argv.includes('--watch');

const ctx = await build({
  entryPoints: ['src/index.js'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/cli.js',
  jsx: 'automatic',
  loader: { '.js': 'jsx' },
  // Keep third-party packages external: only local src is bundled (JSX
  // transform + single entry). npm installs deps alongside, so global
  // installs work, and we avoid CJS-in-ESM interop hazards from ink's
  // dependency tree.
  packages: 'external',
  banner: { js: '#!/usr/bin/env node' },
  external: ['node:*'],
  logLevel: 'info',
});

await mkdir('dist', { recursive: true }).catch(() => {});
await chmod('dist/cli.js', 0o755);

if (watch) {
  console.log('Watch mode not implemented as incremental build; rebuild on change.');
}
