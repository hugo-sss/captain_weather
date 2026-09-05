// Deterministic browse fixtures for the /preview harness: a SW-monsoon flow over the Andaman Sea
// (8–25 kn) with one squally patch drifting north-east, waves 0.5–2.2 m, and a RainViewer frame
// list. Never imported by production code: only the PREVIEW_MOCK Vite alias reaches this file.
import { ATMOS_VARS, MARINE_VARS, type BrowseModel, type BrowseSource, type CellForecast, type DailySummary, type GridResult, type LatLon, type PointForecast, type RadarFrames, type RunInfo } from './types.ts';
import { deriveRun } from './openMeteo.ts';

const H = 3_600_000;
const DEG = Math.PI / 180;

/** Rough land mask for Phuket, Phang Nga and the Krabi mainland so land cells show the hatched no-data state. */
export function isLand(lat: number, lon: number): boolean {
  if (lat > 7.75 && lat < 8.2 && lon > 98.25 && lon < 98.45) return true; // Phuket island
  if (lat > 8.15 && lon > 98.25) return true; // mainland north
  if (lat > 7.5 && lat < 8.15 && lon > 98.8 + (8.15 - lat) * 0.5) return true; // Krabi coast
  if (lat < 7.5 && lon > 99.15) return true; // Trang coast
  return false;
}

/** Wind speed (kn) and FROM direction (°) for a lat/lon at t hours after the series start. */
export function synthWind(lat: number, lon: number, tHours: number): { speed: number; dir: number } {
  const base = 12 + 5 * Math.sin((tHours / 24) * 2 * Math.PI - 1) + 3 * Math.sin((lon - 97.5) * 2.2) - 2.5 * Math.cos((lat - 7.6) * 3.1);
  const offshore = Math.max(0, 98.3 - lon) * 4; // stronger to the west, into the open Andaman
  // Squall line: a Gaussian bump that drifts north-east through day 2.
  const cx = 97.9 + tHours * 0.02, cy = 7.2 + tHours * 0.012;
  const d2 = ((lon - cx) * Math.cos(lat * DEG)) ** 2 + (lat - cy) ** 2;
  const squall = 13 * Math.exp(-d2 / 0.18) * (tHours > 18 && tHours < 54 ? 1 : 0.25);
  const speed = Math.max(3, Math.min(34, base + offshore + squall));
  const dir = (232 + 12 * Math.sin((lat - 7) * 2.5 + tHours / 9) + 8 * Math.cos((lon - 98) * 1.7) - squall * 1.5 + 360) % 360;
  return { speed: Math.round(speed * 10) / 10, dir: Math.round(dir) };
}

function synthCell(lat: number, lon: number, times: string[], startMs: number): CellForecast {
  const vars: CellForecast['vars'] = {};
  const land = isLand(lat, lon);
  const n = times.length;
  const s = new Array<number | null>(n), d = new Array<number | null>(n), g = new Array<number | null>(n), p = new Array<number | null>(n), r = new Array<number | null>(n), t = new Array<number | null>(n);
  const wh = new Array<number | null>(n), wd = new Array<number | null>(n), wp = new Array<number | null>(n), sh = new Array<number | null>(n), sd = new Array<number | null>(n), sp = new Array<number | null>(n);
  for (let i = 0; i < n; i++) {
    const th = (Date.parse(times[i]) - startMs) / H;
    const w = synthWind(lat, lon, th);
    s[i] = w.speed; d[i] = w.dir;
    g[i] = Math.round((w.speed * 1.35 + 2) * 10) / 10;
    p[i] = Math.round((1008.5 - (w.speed - 12) * 0.25 + 1.2 * Math.sin((th / 12) * 2 * Math.PI)) * 10) / 10;
    r[i] = Math.round(Math.max(0, w.speed - 20) * 0.9 * 100) / 100;
    t[i] = Math.round((28.5 + 1.8 * Math.sin(((th - 8) / 24) * 2 * Math.PI) - (land ? 0 : 0.6)) * 10) / 10;
    if (!land) {
      const h = Math.max(0.4, Math.min(2.6, 0.45 + w.speed * 0.065 + Math.max(0, 98.3 - lon) * 0.35));
      wh[i] = Math.round(h * 100) / 100; wd[i] = Math.round((w.dir + 8) % 360); wp[i] = Math.round((5 + h * 1.6) * 10) / 10;
      sh[i] = Math.round(Math.max(0.3, h * 0.7) * 100) / 100; sd[i] = Math.round((238 + 6 * Math.sin(lat)) % 360); sp[i] = Math.round((9 + h * 1.2) * 10) / 10;
    } else { wh[i] = wd[i] = wp[i] = sh[i] = sd[i] = sp[i] = null; }
  }
  vars.wind_speed_10m = s; vars.wind_direction_10m = d; vars.wind_gusts_10m = g; vars.pressure_msl = p; vars.precipitation = r; vars.temperature_2m = t;
  if (!land) { vars.wave_height = wh; vars.wave_direction = wd; vars.wave_period = wp; vars.swell_wave_height = sh; vars.swell_wave_direction = sd; vars.swell_wave_period = sp; }
  return { lat, lon, times, vars };
}

/** Series starts at today 00Z, like Open-Meteo. */
function seriesTimes(now: Date, stepHours: number, days: number): { times: string[]; startMs: number } {
  const startMs = Math.floor(now.getTime() / (24 * H)) * 24 * H;
  const times: string[] = [];
  for (let ms = startMs; ms < startMs + days * 24 * H; ms += stepHours * H) times.push(new Date(ms).toISOString().slice(0, 16) + ':00Z');
  return { times, startMs };
}

export class FixtureBrowseSource implements BrowseSource {
  readonly name = 'fixture' as const;
  constructor(private readonly now: () => Date = () => new Date(), private readonly latencyMs = 60) {}

  private run(model: BrowseModel): RunInfo { return deriveRun(model, this.now(), 12.4); }

  async fetchGrid(points: LatLon[], model: BrowseModel): Promise<GridResult> {
    await new Promise((r) => setTimeout(r, this.latencyMs));
    const { times, startMs } = seriesTimes(this.now(), 3, 3);
    // GFS "disagrees" a little so the model chip visibly changes the field.
    const bias = model === 'gfs_seamless' ? 0.88 : 1;
    const cells = points.map((p) => { const c = synthCell(p.lat, p.lon, times, startMs); if (bias !== 1) c.vars.wind_speed_10m = c.vars.wind_speed_10m!.map((v) => (v === null ? null : Math.round(v * bias * 10) / 10)); return c; });
    return { run: this.run(model), cells };
  }

  async fetchPoint(p: LatLon, model: BrowseModel): Promise<PointForecast> {
    await new Promise((r) => setTimeout(r, this.latencyMs));
    const { times, startMs } = seriesTimes(this.now(), 1, 3);
    const c = synthCell(p.lat, p.lon, times, startMs);
    const land = isLand(p.lat, p.lon);
    const daily: DailySummary[] = [];
    for (let day = 0; day < 7; day++) {
      const speeds = Array.from({ length: 8 }, (_, k) => synthWind(p.lat, p.lon, day * 24 + k * 3).speed);
      const mx = Math.max(...speeds);
      daily.push({ date: new Date(startMs + day * 24 * H).toISOString().slice(0, 10), tMaxC: Math.round((30.3 - day * 0.2) * 10) / 10, tMinC: Math.round((25.9 + (day % 3) * 0.3) * 10) / 10, windMaxKn: Math.round(mx * 10) / 10, gustMaxKn: Math.round((mx * 1.35 + 2) * 10) / 10, precipMm: Math.round(Math.max(0, mx - 19) * 2.4 * 10) / 10 });
    }
    return { lat: p.lat, lon: p.lon, run: this.run(model), marineRun: land ? null : { runLabel: this.run(model).runLabel }, hourly: { times, vars: c.vars }, daily, marineReason: land ? 'no sea cell at this point (marine model returns null on land)' : null };
  }

  async fetchRadarFrames(): Promise<RadarFrames> {
    const now = Math.floor(this.now().getTime() / 1000);
    const latest = Math.floor(now / 600) * 600 - 360; // last frame ~6 min old
    const frame = (t: number, kind: 'v2/radar' | 'v2/radar/nowcast') => ({ time: t, path: `/${kind}_${t}` });
    return {
      host: 'https://tilecache.rainviewer.com', generated: now,
      past: Array.from({ length: 13 }, (_, i) => frame(latest - (12 - i) * 600, 'v2/radar')),
      nowcast: Array.from({ length: 3 }, (_, i) => frame(latest + (i + 1) * 600, 'v2/radar/nowcast')),
    };
  }
}

export { ATMOS_VARS, MARINE_VARS };
