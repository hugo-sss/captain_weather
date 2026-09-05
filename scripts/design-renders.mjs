// Screenshot every screen against the fixture-backed dev server.
//   PREVIEW_MOCK=1 pnpm exec vite --port 5199      (in another shell)
//   node scripts/design-renders.mjs --prefix after --base http://localhost:5199 --out /tmp/design-renders
//   node scripts/design-renders.mjs --set phase5 --prefix phase5-after      (Phase 5 shots: leg profile, tide, alerts, depth, print, offline)
// Uses the globally installed Playwright (falls back to a local one) and the Chromium in PLAYWRIGHT_BROWSERS_PATH.
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : [])).filter((e) => e.length));
const prefix = args.prefix ?? 'after';
const base = args.base ?? 'http://localhost:5199';
const out = args.out ?? '/tmp/design-renders';
const only = args.only ? new Set(args.only.split(',')) : null;
const set = args.set ?? 'default';
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

/** Weather landing (phase 4): the map is fixture-backed, so nothing here needs the network. */
const mapPoint = async (page, fx, fy) => { const box = await page.locator('.leaflet-container').first().boundingBox(); return [box.x + box.width * fx, box.y + box.height * fy]; };
const tapOrClick = async (page, view, x, y) => { if (view === 'mobile') await page.touchscreen.tap(x, y); else { await page.mouse.move(x, y); await page.waitForTimeout(450); await page.mouse.click(x, y); } };
const openPlanning = async (page, view) => {
  await page.getByRole('button', { name: /^Plan a passage$/ }).first().click();
  await page.waitForTimeout(400);
  // On a phone the first tap opens the sheet; the sheet's own button starts planning and yields the map.
  if (view === 'mobile') { await page.getByRole('button', { name: /^Plan a passage$/ }).last().click(); await page.waitForTimeout(400); }
};

/** name, path, which viewports, optional interaction before the shot */
const SHOTS = [
  { name: 'landing', path: '/', views: ['desktop', 'mobile'], settle: 1800 },
  { name: 'pointcard', path: '/', views: ['desktop', 'mobile'], settle: 1800, act: async (page, view) => { const [x, y] = await mapPoint(page, 0.42, 0.42); await tapOrClick(page, view, x, y); await page.waitForTimeout(900); } },
  { name: 'radar', path: '/', views: ['desktop', 'mobile'], act: async (page) => { await page.getByRole('button', { name: /^Radar/ }).click(); await page.waitForTimeout(900); } },
  { name: 'waves', path: '/', views: ['desktop', 'mobile'], act: async (page) => { await page.getByRole('button', { name: /^Waves/ }).click(); await page.waitForTimeout(900); } },
  { name: 'plan', path: '/', views: ['desktop', 'mobile'], act: async (page, view) => {
    await openPlanning(page, view);
    for (const [fx, fy] of view === 'mobile' ? [[0.3, 0.3], [0.7, 0.5]] : [[0.3, 0.4], [0.62, 0.55]]) { const [x, y] = await mapPoint(page, fx, fy); await tapOrClick(page, view, x, y); await page.waitForTimeout(400); }
    if (view === 'mobile') { await page.getByRole('button', { name: /Passage panel/ }).click(); }
    await page.waitForTimeout(1200);
  } },
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

/** Phase 5 shots. `pro` doubles as the "before" shot when pointed at the base-commit server. */
const selectKoHa = async (page, view) => { await page.locator(view === 'mobile' ? '[role="button"]:has-text("Ko Ha") >> visible=true' : 'tr:has-text("Ko Ha") >> visible=true').first().click(); await page.waitForTimeout(700); };
const hoverProfile = async (page, view, fx = 0.62) => {
  const svg = page.locator('svg[aria-label^="Conditions along the leg"]').first();
  await svg.scrollIntoViewIfNeeded();
  const box = await svg.boundingBox(); if (!box) return;
  const x = box.x + box.width * fx, y = box.y + box.height * 0.4;
  if (view === 'mobile') await page.touchscreen.tap(x, y); else await page.mouse.move(x, y);
  await page.waitForTimeout(400);
};
const PHASE5 = [
  { name: 'pro', path: '/passages/p1', views: ['desktop', 'mobile'], act: selectKoHa },
  { name: 'legprofile', path: '/passages/p1', views: ['desktop', 'mobile'], act: async (page, view) => { await selectKoHa(page, view); await hoverProfile(page, view); } },
  { name: 'tide', path: '/passages/p1', views: ['desktop', 'mobile'], act: async (page, view) => { await selectKoHa(page, view); await page.getByRole('radio', { name: 'Tide only' }).click(); await page.waitForTimeout(600); } },
  { name: 'tidehere', path: '/', views: ['desktop', 'mobile'], settle: 1800, viewport: true, act: async (page, view) => { const [x, y] = await mapPoint(page, 0.42, 0.42); await tapOrClick(page, view, x, y); await page.waitForTimeout(900); await page.getByRole('button', { name: /Load station tide/ }).click(); await page.waitForTimeout(1200); } },
  { name: 'alerts', path: '/passages/p1', views: ['desktop', 'mobile'], viewport: true, act: async (page) => { await page.getByRole('button', { name: /^Alerts/ }).click(); await page.waitForTimeout(500); } },
  { name: 'depth', path: '/passages/p1/edit', views: ['desktop', 'mobile'], viewport: true, act: async (page) => { await page.getByText('Ko Phi Phi Don', { exact: false }).first().click(); await page.waitForTimeout(400); await page.getByRole('button', { name: /Suggest from GEBCO/ }).click(); await page.waitForTimeout(1000); } },
  { name: 'print', path: '/passages/p1/print?noprint=1', views: ['desktop'], settle: 2200 },
  { name: 'offline', path: '/passages/p1', views: ['desktop', 'mobile'], act: async (page) => { await page.waitForTimeout(800); await page.goto(`${base}/passages/p1?offline=1`, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => undefined); await page.waitForTimeout(1500); } },
];
const ACTIVE = set === 'phase5' ? PHASE5 : SHOTS;

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true });
try {
  for (const shot of ACTIVE) {
    if (only && !only.has(shot.name)) continue;
    for (const view of shot.views) {
      const ctx = await browser.newContext(view === 'mobile' ? MOBILE : DESKTOP);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => console.error(`[${shot.name}/${view}] page error:`, e.message));
      await page.goto(`${base}${shot.path}`, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => undefined);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(shot.settle ?? 1200);
      if (shot.act) await shot.act(page, view);
      await page.waitForTimeout(300);
      const file = `${out}/${prefix}-${shot.name}-${view}.png`;
      // Dialog-open shots and the full-bleed map must not be full page: their overlays are fixed to the viewport.
      await page.screenshot({ path: file, fullPage: !shot.viewport && !shot.name.endsWith('-sheet') && shot.path !== '/' });
      console.log('wrote', file);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
