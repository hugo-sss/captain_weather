// Review helper: at phone width, list elements that overflow the viewport and take viewport-sized
// crops down the page so a long screen can be read piece by piece.
//   node scripts/mobile-review.mjs --path /passages/p1 --prefix p1 [--base http://localhost:5199] [--out DIR] [--prefs '{"detail_level":"simple"}']
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : [])).filter((e) => e.length));
const base = args.base ?? 'http://localhost:5199';
const out = args.out ?? '/tmp/design-renders/mobile-review';
const path = args.path ?? '/passages/p1';
const prefix = args.prefix ?? 'page';
const width = Number(args.width ?? 390);
mkdirSync(out, { recursive: true });

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const browser = await chromium.launch({ headless: true });
// isMobile off for the same reason as in design-renders.mjs: the emulated layout viewport would hide the tab bar.
const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2, isMobile: false, hasTouch: true, colorScheme: 'dark' });
const prefs = JSON.stringify({ narrative_emphasis: 0, use_current: false, show_openseamap: true, show_noaa_enc: false, local_utc_offset_min: 420, detail_level: 'simple', ...(args.prefs ? JSON.parse(args.prefs) : {}) });
await ctx.addInitScript((p) => { try { localStorage.setItem('cpt.displayPrefs.v1', p); } catch { /* ignore */ } }, prefs);
const page = await ctx.newPage();
await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => undefined);
await page.waitForTimeout(1800);
const report = await page.evaluate((vw) => {
  const doc = document.scrollingElement;
  const wide = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > vw + 1) {
      const cls = (el.getAttribute('class') ?? '').slice(0, 90);
      wide.push({ tag: el.tagName.toLowerCase(), cls, right: Math.round(r.right), width: Math.round(r.width), text: (el.textContent ?? '').trim().slice(0, 40) });
    }
  }
  return { scrollWidth: doc.scrollWidth, scrollHeight: doc.scrollHeight, wide: wide.slice(0, 25) };
}, width);
console.log(JSON.stringify({ scrollWidth: report.scrollWidth, scrollHeight: report.scrollHeight }, null, 0));
for (const w of report.wide) console.log(`${w.right}px  ${w.tag}.${w.cls}  "${w.text}"`);
const H = 844;
const n = Math.min(12, Math.ceil(report.scrollHeight / H));
for (let i = 0; i < n; i++) {
  await page.evaluate((y) => window.scrollTo(0, y), i * H);
  await page.waitForTimeout(350);
  const file = `${out}/${prefix}-${String(i + 1).padStart(2, '0')}.png`;
  await page.screenshot({ path: file, fullPage: false });
  console.log('wrote', file);
}
await browser.close();
