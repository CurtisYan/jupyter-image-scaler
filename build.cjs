const esbuild = require('esbuild');
Promise.all([
  esbuild.build({ entryPoints: ['src/extension.cjs'], bundle: true, platform: 'node', format: 'cjs', external: ['vscode'], outfile: 'dist/extension.cjs' }),
  esbuild.build({ entryPoints: ['src/renderer.mjs'], bundle: true, platform: 'browser', format: 'esm', outfile: 'dist/renderer.js' })
]).catch(() => process.exit(1));
