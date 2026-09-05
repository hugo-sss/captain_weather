// Screenshot every screen against the fixture-backed dev server.
//   PREVIEW_MOCK=1 pnpm exec vite --port 5199      (in another shell)
//   node scripts/design-renders.mjs --prefix after --base http://localhost:5199 --out /tmp/design-renders
// Uses the globally installed Playwright (falls back to a local one) and the Chromium in PLAYWRIGHT_BROWSERS_PATH.
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : [])).filter((e) => e.length));
const prefix = args.prefix ?? 'after';
const base = args.base ?? 'http://localhost:5199';
const out = args.out ?? '/tmp/design-renders';
const only = args.only ? new Set(args.only.split(',')) : null;
mkdirSync(out, { recursive: true });

async function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(p); } catch { /* next */ }
  }
  throw new Error('playwright not found');
}

const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'dark' };
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' };

/** name, path, which viewports, optional interaction before the shot */
const SHOTS = [
  { name: 'dashboard-pro', path: '/passages/p1', views: ['desktop', 'mobile'] },
  { name: 'dashboard-simple', path: '/passages/p1/simple', views: ['desktop', 'mobile'] },
  { name: 'comparison', path: '/passages/p1/comparison', views: ['desktop'] },
  { name: 'anchorage', path: '/passages/p1/anchorage/wp5', views: ['desktop', 'mobile'] },
  { name: 'active', path: '/passages/p1/active', views: ['desktop', 'mobile'] },
  { name: 'builder', path: '/passages/p1/edit', views: ['desktop'] },
  { name: 'builder-sheet', path: '/passages/p1/edit', views: ['desktop'], act: async (page) => { await page.getByText('Ko Racha Yai', { exact: false }).first().click(); await page.waitForTimeout(400); } },
  { name: 'vessel', path: '/vessels/v1', views: ['desktop', 'mobile'] },
  { name: 'history', path: '/passages', views: ['desktop', 'mobile'] },
  { name: 'gallery', path: '/preview', views: ['desktop', 'mobile'] },
];

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true });
try {
  for (const shot of SHOTS) {
    if (only && !only.has(shot.name)) continue;
    for (const view of shot.views) {
      const ctx = await browser.newContext(view === 'mobile' ? MOBILE : DESKTOP);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => console.error(`[${shot.name}/${view}] page error:`, e.message));
      await page.goto(`${base}${shot.path}`, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => undefined);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1200);
      if (shot.act) await shot.act(page);
      await page.waitForTimeout(300);
      const file = `${out}/${prefix}-${shot.name}-${view}.png`;
      // Dialog-open shots must not be full page: the overlay is fixed to the viewport.
      await page.screenshot({ path: file, fullPage: !shot.name.endsWith('-sheet') });
      console.log('wrote', file);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
