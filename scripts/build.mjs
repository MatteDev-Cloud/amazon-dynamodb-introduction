import { build } from 'esbuild';
await build({entryPoints:['backend/src/handler.ts'],bundle:true,platform:'node',target:'node22',format:'cjs',outfile:'backend/dist/handler.cjs',sourcemap:true});
