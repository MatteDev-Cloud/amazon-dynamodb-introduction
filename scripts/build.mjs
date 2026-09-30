import { rm } from 'node:fs/promises';
import { build } from 'esbuild';
// handler.js (not .cjs): Lambda resolves "handler.handler" against .js without depending on runtime extension
// probing, and with no package.json in the bundle .js means CommonJS, which is the format emitted here.
await rm('backend/dist', {recursive:true, force:true});
await build({
  entryPoints:['backend/src/handler.ts'], bundle:true, platform:'node', target:'node22', format:'cjs',
  outfile:'backend/dist/handler.js', sourcemap:true, minify:true, legalComments:'none',
});
