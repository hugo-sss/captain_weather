// Browse-mode state: sampling grid for the view, per-cell cache keyed by (cell, model, run), the
// scrubber time step, the inspect point, and the radar frame list. Live, ephemeral, never persisted.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cellKey, deriveRun, getBrowseSource, gridForView, gridPoints, pointCacheKey, type Bounds, type BrowseModel, type CellForecast, type GridSpec, type PointForecast, type RadarFrames, type RunInfo } from '@/lib/weather-browse/index.ts';
import type { FieldKind } from '@/lib/weather-browse/ramps.ts';

export type BrowseView = { bounds: Bounds; zoom: number; centre: { lat: number; lon: number } };
export type Inspect = { lat: number; lon: number; pinned: boolean; x: number; y: number };

const MAX_CACHE_CELLS = 6000;
const RADAR_REFRESH_MS = 5 * 60_000;
const MODEL_KEY = 'cpt.browseModel.v1';

// Tab-wide, ephemeral caches keyed by (cell, model, run) and (0.1° point, model). Nothing is persisted.
const cellCache = new Map<string, CellForecast>();
const inflight = new Set<string>();
const pointCache = new Map<string, PointForecast>();

function readCells(spec: GridSpec | null, model: BrowseModel, runIso: string): CellForecast[] {
  if (!spec) return [];
  const out: CellForecast[] = [];
  for (const p of gridPoints(spec)) { const c = cellCache.get(cellKey(p, model, runIso)); if (c) out.push(c); }
  return out;
}

function readModel(): BrowseModel {
  try { const m = localStorage.getItem(MODEL_KEY); return m === 'gfs_seamless' ? 'gfs_seamless' : 'ecmwf_ifs025'; } catch { return 'ecmwf_ifs025'; }
}

/** Index of the time step nearest to now (or the first future step if now is before the series). */
export function nearestStep(times: string[], nowMs = Date.now()): number {
  if (times.length === 0) return 0;
  let best = 0, bestD = Infinity;
  times.forEach((t, i) => { const d = Math.abs(Date.parse(t) - nowMs); if (d < bestD) { bestD = d; best = i; } });
  return best;
}

export function useWeatherBrowse() {
  const source = useMemo(() => getBrowseSource(), []);
  const [model, setModelState] = useState<BrowseModel>(readModel);
  const [field, setField] = useState<FieldKind>('wind');
  const [particles, setParticles] = useState(true);
  const [radarOn, setRadarOn] = useState(false);
  const [view, setView] = useState<BrowseView | null>(null);
  const [run, setRun] = useState<RunInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const setModel = useCallback((m: BrowseModel) => { setModelState(m); try { localStorage.setItem(MODEL_KEY, m); } catch { /* ignore */ } }, []);

  const spec: GridSpec | null = useMemo(() => (view ? gridForView(view.bounds, view.zoom) : null), [view]);

  // The assumed run rolls over every 6 h; re-derived whenever data lands (version) or the model changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const runIso = useMemo(() => deriveRun(model).runIso, [model, version]);

  // Cells for the current spec, read from the tab-wide cache (version invalidates). Missing cells are simply absent.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cells = useMemo(() => readCells(spec, model, runIso), [spec, model, runIso, version]);

  const coverage = spec ? cells.length / (spec.nx * spec.ny) : 0;

  // Fetch whatever the current grid still lacks. One bulk request per view change; aborted if the view moves on.
  useEffect(() => {
    if (!spec) return;
    const missing = gridPoints(spec).filter((p) => { const k = cellKey(p, model, runIso); return !cellCache.has(k) && !inflight.has(k); });
    if (missing.length === 0) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const keys = missing.map((p) => cellKey(p, model, runIso));
    keys.forEach((k) => inflight.add(k));
    const start = () => {
      if (ac.signal.aborted) return;
      setLoading(true); setError(null);
      source.fetchGrid(missing, model, ac.signal).then((res) => {
        if (ac.signal.aborted) return;
        res.cells.forEach((c, i) => cellCache.set(keys[i], c));
        if (cellCache.size > MAX_CACHE_CELLS) { const drop = cellCache.size - MAX_CACHE_CELLS; let n = 0; for (const k of cellCache.keys()) { if (n++ >= drop) break; cellCache.delete(k); } }
        setRun(res.run);
        setVersion((v) => v + 1);
      }).catch((e: Error) => { if (e.name !== 'AbortError') setError(e.message); })
        .finally(() => { keys.forEach((k) => inflight.delete(k)); if (!ac.signal.aborted) setLoading(false); });
    };
    void Promise.resolve().then(start);
    return () => { ac.abort(); keys.forEach((k) => inflight.delete(k)); };
  }, [spec, model, runIso, source]);

  // ---- Time axis ----------------------------------------------------------------------------
  const times = useMemo(() => cells.reduce<string[]>((best, c) => (c.times.length > best.length ? c.times : best), []), [cells]);
  const [timeIndex, setTimeIndexState] = useState<number | null>(null);
  const idx = timeIndex === null ? nearestStep(times) : Math.min(timeIndex, Math.max(0, times.length - 1));
  const timeIso = times[idx] ?? null;
  const setTimeIndex = useCallback((i: number | ((prev: number) => number)) => setTimeIndexState((prev) => { const cur = prev ?? nearestStep(times); const n = typeof i === 'function' ? i(cur) : i; return Math.max(0, Math.min(times.length - 1, n)); }), [times]);

  // ---- Inspect point ------------------------------------------------------------------------
  const [inspect, setInspect] = useState<Inspect | null>(null);
  const [point, setPoint] = useState<PointForecast | null>(null);
  const [pointLoading, setPointLoading] = useState(false);
  const pointAbort = useRef<AbortController | null>(null);

  const fetchPoint = useCallback(async (lat: number, lon: number): Promise<PointForecast | null> => {
    const key = pointCacheKey({ lat, lon }, model);
    const hit = pointCache.get(key);
    if (hit) return hit;
    pointAbort.current?.abort();
    const ac = new AbortController();
    pointAbort.current = ac;
    try {
      const p = await source.fetchPoint({ lat, lon }, model, ac.signal);
      pointCache.set(key, p);
      if (pointCache.size > 200) pointCache.delete(pointCache.keys().next().value as string);
      return p;
    } catch (e) { if ((e as Error).name !== 'AbortError') setError((e as Error).message); return null; }
  }, [model, source]);

  /** Cheap: move the card to a new spot (hover). Does not fetch. */
  const hover = useCallback((lat: number, lon: number, x: number, y: number) => {
    setInspect((cur) => (cur?.pinned ? cur : { lat, lon, x, y, pinned: false }));
  }, []);
  /** Hover settled, or a tap: fetch the hourly point series for the card. */
  const settle = useCallback((lat: number, lon: number, pin: boolean, x: number, y: number) => {
    setInspect((cur) => (cur?.pinned && !pin ? cur : { lat, lon, x, y, pinned: pin || !!cur?.pinned }));
    const key = pointCacheKey({ lat, lon }, model);
    const hit = pointCache.get(key);
    if (hit) { setPoint(hit); return; }
    setPointLoading(true);
    void fetchPoint(lat, lon).then((p) => { if (p) setPoint(p); }).finally(() => setPointLoading(false));
  }, [fetchPoint, model]);
  const unpin = useCallback(() => { setInspect(null); setPoint(null); }, []);
  const clearHover = useCallback(() => setInspect((cur) => (cur?.pinned ? cur : null)), []);
  // A point fetched for a different spot than the card must not be shown under the new coordinates.
  const pointMatches = !!point && !!inspect && Math.abs(point.lat - inspect.lat) < 0.051 && Math.abs(point.lon - inspect.lon) < 0.051;

  // ---- Daily strip: pinned point, else the map centre (debounced by the view itself) --------
  const [daily, setDaily] = useState<PointForecast | null>(null);
  const dailyLat = inspect?.pinned ? inspect.lat : view?.centre.lat ?? null;
  const dailyLon = inspect?.pinned ? inspect.lon : view?.centre.lon ?? null;
  const dailyTarget = useMemo(() => (dailyLat !== null && dailyLon !== null ? { lat: dailyLat, lon: dailyLon } : null), [dailyLat, dailyLon]);
  const dailyKey = dailyTarget ? pointCacheKey(dailyTarget, model) : null;
  useEffect(() => {
    if (!dailyTarget || !dailyKey) return;
    let cancelled = false;
    const hit = pointCache.get(dailyKey);
    const t = setTimeout(() => {
      if (hit) { setDaily(hit); return; }
      void source.fetchPoint(dailyTarget, model).then((p) => { if (cancelled) return; pointCache.set(dailyKey, p); setDaily(p); }).catch(() => undefined);
    }, hit ? 0 : 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [dailyTarget, dailyKey, model, source]);

  // ---- Radar ----------------------------------------------------------------------------------
  const [radar, setRadar] = useState<RadarFrames | null>(null);
  const [radarError, setRadarError] = useState<string | null>(null);
  const [radarFrame, setRadarFrame] = useState<number | null>(null);
  useEffect(() => {
    if (!radarOn) return;
    let cancelled = false;
    const load = () => source.fetchRadarFrames().then((r) => { if (!cancelled) { setRadar(r); setRadarError(null); } }).catch((e: Error) => { if (!cancelled) setRadarError(e.message); });
    void load();
    const t = setInterval(load, RADAR_REFRESH_MS);
    return () => { cancelled = true; clearInterval(t); };
  }, [radarOn, source]);
  const radarFrames = useMemo(() => (radar ? [...radar.past.map((f) => ({ ...f, nowcast: false })), ...radar.nowcast.map((f) => ({ ...f, nowcast: true }))] : []), [radar]);
  const radarIdx = radar ? (radarFrame === null ? Math.max(0, radar.past.length - 1) : Math.min(radarFrame, radarFrames.length - 1)) : 0;

  return {
    source: source.name, model, setModel, field, setField, particles, setParticles, radarOn, setRadarOn,
    view, setView, spec, cells, coverage, run, loading, error,
    times, timeIndex: idx, timeIso, setTimeIndex,
    inspect, point: pointMatches ? point : null, pointLoading, hover, settle, unpin, clearHover,
    daily, dailyTarget,
    radar, radarError, radarFrames, radarIdx, setRadarFrame,
  };
}

export type WeatherBrowse = ReturnType<typeof useWeatherBrowse>;
