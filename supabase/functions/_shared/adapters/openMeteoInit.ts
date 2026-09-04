// Model run (init) time resolution for Open-Meteo sources.
// 1. Try the per-model metadata endpoint `/data/<model>/static/meta.json`
//    (`last_run_initialisation_time`, unix seconds).
// 2. Otherwise floor (now − availability lag) to the model cycle. The lag makes
//    the fallback conservative: lead time is overstated, never understated.
import type { AdapterEnv } from '../contracts.ts';

export const MODEL_CYCLE_HOURS: Record<string, number> = {
  google_weathernext2_ensemble: 6, // issued at 6-hour intervals per Open-Meteo's WeatherNext page
  ecmwf_ifs025_ensemble: 6,       // 00/06/12/18 (docs caveat: ENS variables limited on 06/18)
  ncep_gfs_global: 6,
  meteofrance_wave: 12,
  meteofrance_currents: 24,
  'open-meteo-marine': 12,
};
const AVAILABILITY_LAG_HOURS = 6;

export async function resolveInitTime(env: AdapterEnv, apiBase: string, model: string): Promise<{ initTime: string; via: 'meta' | 'fallback' }> {
  try {
    const res = await env.fetch(`${apiBase}/data/${model}/static/meta.json`);
    if (res.ok) {
      const meta = (await res.json()) as { last_run_initialisation_time?: number };
      if (typeof meta.last_run_initialisation_time === 'number' && meta.last_run_initialisation_time > 0) {
        return { initTime: new Date(meta.last_run_initialisation_time * 1000).toISOString(), via: 'meta' };
      }
    }
  } catch { /* fall through */ }
  const cycle = MODEL_CYCLE_HOURS[model] ?? 6;
  const t = env.now().getTime() - AVAILABILITY_LAG_HOURS * 3_600_000;
  const cycleMs = cycle * 3_600_000;
  return { initTime: new Date(Math.floor(t / cycleMs) * cycleMs).toISOString(), via: 'fallback' };
}
