// Shapes shared by adapters, edge functions and the UI. PRD §5, §11.

export type Layer = 'atmospheric' | 'comparison' | 'marine' | 'tidal';

export type IngestTarget = {
  id: number;
  layer: Layer;
  grid_lat: number;
  grid_lon: number;
  station_id: string | null;
  horizon_end: string | null;
  next_fetch_at: string;
  last_fetched_at: string | null;
  last_init_time: string | null;
  last_error: string | null;
  active: boolean;
};

export type AtmosphericRow = {
  target_id: number;
  source: string;
  kind: 'ensemble' | 'deterministic';
  init_time: string;
  forecast_time: string;
  member_count: number | null;
  wind_p10_kn: number | null;
  wind_p50_kn: number | null;
  wind_p90_kn: number | null;
  wind_dir_mean_deg: number | null;
  wind_dir_spread_deg: number | null;
  gust_p50_kn: number | null;
  gust_p90_kn: number | null;
  precip_prob_pct: number | null;
  precip_p50_mm: number | null;
  mslp_p10_hpa: number | null;
  mslp_p50_hpa: number | null;
  mslp_p90_hpa: number | null;
  cape_p50_jkg: number | null;
  visibility_p50_m: number | null;
  temp_p50_c: number | null;
  wind_members_kn: number[] | null;
  wind_dir_members_deg: number[] | null;
};

export type MarineRow = {
  target_id: number;
  source: string;
  init_time: string;
  forecast_time: string;
  wave_height_m: number | null;
  wave_dir_deg: number | null;
  wave_period_s: number | null;
  wind_wave_height_m: number | null;
  swell_height_m: number | null;
  swell_dir_deg: number | null;
  swell_period_s: number | null;
  sea_level_msl_m: number | null; // model surface height. NEVER displayed as tide.
  current_speed_kn: number | null;
  current_dir_deg: number | null; // direction the current sets TOWARD
  sst_c: number | null;
};

export type TideDatum = 'CD' | 'LAT' | 'MSL' | 'MLLW' | 'unknown';
export type TideState = 'flood' | 'ebb' | 'high' | 'low' | 'slack';

export type TidalRow = {
  target_id: number;
  source: string;
  station_id: string;
  station_name: string | null;
  station_distance_km: number | null;
  datum: TideDatum;
  forecast_time: string;
  tide_height_m: number | null;
  tide_state: TideState | null;
};

/** What every adapter returns. `notConfigured` is the honest "no key" state. */
export type AdapterResult<Row> =
  | { ok: true; rows: Row[]; init_time: string | null; station_id?: string; notes?: string[] }
  | { ok: false; error: string; notConfigured?: boolean };

export type FetchRange = { start: string; end: string };

export type AdapterEnv = {
  fetch: typeof fetch;
  now: () => Date;
  env: (name: string) => string | undefined;
};

export type ConfidenceLevel = 'high' | 'moderate' | 'low';
export type RiskFlag = 'green' | 'amber' | 'red' | 'unknown';
export type UkcBasis = 'charted+tide+swell' | 'charted+tide' | 'none';
