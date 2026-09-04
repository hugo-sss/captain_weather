// Bundle each edge function into one file so it can be deployed through the
// Supabase MCP tool (which uploads named files) or any single-file path.
// `supabase functions deploy` handles _shared natively; this is the fallback.
import { build } from 'esbuild';
import { existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const fnDir = path.join(root, 'supabase', 'functions');
const names = process.argv.slice(2).length ? process.argv.slice(2)
  : readdirSync(fnDir).filter((d) => !d.startsWith('_') && statSync(path.join(fnDir, d)).isDirectory() && existsSync(path.join(fnDir, d, 'index.ts')));

for (const name of names) {
  const entry = path.join(fnDir, name, 'index.ts');
  const outDir = path.join(fnDir, name, 'bundle');
  mkdirSync(outDir, { recursive: true });
  const r = await build({
    entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'neutral', target: 'esnext',
    external: ['npm:*', 'jsr:*', 'node:*', 'https://*', 'http://*'],
    legalComments: 'none', logLevel: 'silent',
  });
  const code = r.outputFiles[0].text;
  writeFileSync(path.join(outDir, 'index.ts'), code);
  console.log(`${name}: ${(code.length / 1024).toFixed(1)} KB -> supabase/functions/${name}/bundle/index.ts`);
}
