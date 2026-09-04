// Row shapes used by the UI. Numeric columns arrive as strings from PostgREST
// unless coerced; the hooks coerce with `num()` below.
import type { Database } from './database.ts';

type Tables = Database['public']['Tables'];
export type VesselRow = Tables['vessels']['Row'];
export type PassageRow = Tables['passages']['Row'];
export type WaypointRow = Tables['waypoints']['Row'];
export type ConditionsRunRow = Tables['conditions_runs']['Row'];
export type WaypointConditionsRow = Tables['waypoint_conditions']['Row'];
export type AnchorageConditionsRow = Tables['anchorage_conditions']['Row'];
export type BriefingRow = Tables['passage_briefings']['Row'];
export type IngestTargetRow = Tables['ingest_targets']['Row'];
export type ForecastComparisonRow = Database['public']['Views']['forecast_comparison']['Row'];

export type RiskFlag = 'green' | 'amber' | 'red' | 'unknown';
export type ConfidenceLevel = 'high' | 'moderate' | 'low';
export type PassageStatus = 'planned' | 'active' | 'completed' | 'archived';
export type ExposureTag = 'sheltered' | 'partial' | 'exposed';

/** Editable waypoint in the builder before it is saved. */
export type DraftWaypoint = {
  id?: string;
  sequence: number;
  name: string;
  lat: number;
  lon: number;
  planned_speed_kn: number | null;
  is_anchorage: boolean;
  planned_departure_from_here: string | null;
  anchorage_exposure_tag: ExposureTag | null;
  is_complex_coastal: boolean;
  charted_depth_m: number | null;
  source: 'map' | 'gpx' | 'csv' | 'api';
};

export const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export type DisplayPrefs = {
  narrative_emphasis: number; // 0..1, ordering and emphasis only, never data access
  use_current: boolean;
  show_openseamap: boolean;
  show_noaa_enc: boolean;
  local_utc_offset_min: number | null; // null = browser local
};
