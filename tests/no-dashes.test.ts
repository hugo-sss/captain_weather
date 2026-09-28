// House style: no em dashes (U+2014) or en dashes (U+2013) in UI copy. Ranges use "to", asides use commas.
// Covers every .tsx under src (chart axis ticks and the print page included) and the plain-English layer.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

describe('no em or en dashes in UI strings', () => {
  const files = [...walk(join(process.cwd(), 'src')), join(process.cwd(), 'src/lib/plain.ts'), join(process.cwd(), 'src/lib/time.ts'), join(process.cwd(), 'src/lib/units.ts')];
  it('scans a realistic number of files', () => { expect(files.length).toBeGreaterThan(30); });
  for (const f of files) {
    it(f.replace(process.cwd() + '/', ''), () => {
      const lines = readFileSync(f, 'utf8').split('\n');
      const hits = lines.map((l, i) => (/[–—]/.test(l) ? `${i + 1}: ${l.trim().slice(0, 120)}` : null)).filter(Boolean);
      expect(hits, hits.join('\n')).toEqual([]);
    });
  }
});
