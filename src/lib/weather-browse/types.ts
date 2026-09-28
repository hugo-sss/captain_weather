// Browse mode: live, ephemeral, deterministic weather for the map's front door. Nothing here is
// written to the database. Every value is a plain model value, labelled with its model and run.

export type BrowseModel = 'ecmwf_ifs025' | 'gfs_seamless';

export const MODEL_LABEL: Record<BrowseModel, string> = { ecmwf_ifs025: 'ECMWF IFS 0.25°', gfs_seamless: 'GFS 0.25°' };
export const MODEL_SHORT: Record<BrowseModel, string> = { ecmwf_ifs025: 'ECMWF', gfs_seamless: 'GFS' };

/** Atmospheric variables requested from /v1/forecast (wind in kn, pressure hPa, precip mm, temp °C). */
export const ATMOS_VARS = ['wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'pressure_msl', 'precipitation', 'temperature_2m'] as const;
/** Sea-state variables requested from /v1/marine (m, °, s). */
export const MARINE_VARS = ['wave_height', 'wave_direction', 'wave_period', 'swell_wave_height', 'swell_wave_direction', 'swell_wave_period'] as const;

export type AtmosVar = (typeof ATMOS_VARS)[number];
export type MarineVar = (typeof MARINE_VARS)[number];
export type BrowseVar = AtmosVar | MarineVar;

/** One sampling cell: a lat/lon with one value per time step for each variable. Marine arrays may be absent on land. */
export type CellForecast = {
  lat: number;
  lon: number;
  times: string[]; // ISO UTC, 3-hourly, 72 h
  vars: Partial<Record<BrowseVar, (number | null)[]>>;
};

/** Model run information, derived (Open-Meteo does not return the init time in the forecast body). */
export type RunInfo = {
  model: BrowseModel;
  /** ISO of the assumed model cycle, floored from now minus the availability lag. Always approximate. */
  runIso: string;
  /** e.g. "≈ run 06Z" */
  runLabel: string;
  generationTimeMs: number | null;
};

export type GridResult = { run: RunInfo; cells: CellForecast[] };

/** Point inspect data: hourly series for the card plus a 7-day daily summary for the strip. */
export type PointForecast = {
  lat: number;
  lon: number;
  run: RunInfo;
  marineRun: { runLabel: string } | null;
  hourly: { times: string[]; vars: Partial<Record<BrowseVar, (number | null)[]>> };
  daily: DailySummary[];
  /** Why marine is missing, when it is (e.g. "no sea cell at this point"). */
  marineReason: string | null;
};

export type DailySummary = { date: string; tMaxC: number | null; tMinC: number | null; windMaxKn: number | null; gustMaxKn: number | null; precipMm: number | null };

export type RadarFrame = { time: number; path: string };
export type RadarFrames = { host: string; generated: number; past: RadarFrame[]; nowcast: RadarFrame[] };

export type LatLon = { lat: number; lon: number };

/** Everything the UI needs from the network, so fixtures can stand in for it. */
export interface BrowseSource {
  readonly name: 'open-meteo' | 'fixture';
  fetchGrid(points: LatLon[], model: BrowseModel, signal?: AbortSignal): Promise<GridResult>;
  fetchPoint(point: LatLon, model: BrowseModel, signal?: AbortSignal): Promise<PointForecast>;
  fetchRadarFrames(signal?: AbortSignal): Promise<RadarFrames>;
}
