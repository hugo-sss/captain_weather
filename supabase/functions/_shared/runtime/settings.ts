import type { Admin } from './supabaseAdmin.ts';
import { DEFAULT_CONFIDENCE_RULES, type ConfidenceRules } from '../confidence.ts';
import { DEFAULT_DISAGREEMENT_THRESHOLDS, type DisagreementThresholds } from '../risk.ts';

export type Sources = { atmospheric_primary: string; atmospheric_secondary: string; comparison: string; marine: string; tidal: string };
export type Settings = {
  disagreement_thresholds: DisagreementThresholds;
  confidence_rules: ConfidenceRules;
  risk_defaults: { amber_fraction_of_limit: number; gust_factor_if_missing: number };
  sources: Sources;
  cache_retention_days: number;
  ingest_grid: { spacing_deg: number; corridor_km: number; horizon_hours: number };
};

export const DEFAULT_SETTINGS: Settings = {
  disagreement_thresholds: DEFAULT_DISAGREEMENT_THRESHOLDS,
  confidence_rules: DEFAULT_CONFIDENCE_RULES,
  risk_defaults: { amber_fraction_of_limit: 0.75, gust_factor_if_missing: 1.3 },
  sources: { atmospheric_primary: 'google_weathernext2_ensemble', atmospheric_secondary: 'ecmwf_ifs025_ensemble', comparison: 'ncep_gfs_global', marine: 'open-meteo-marine', tidal: 'tidesatlas' },
  cache_retention_days: 3,
  ingest_grid: { spacing_deg: 0.25, corridor_km: 25, horizon_hours: 240 },
};

export async function loadSettings(admin: Admin): Promise<Settings> {
  const { data } = await admin.from('app_settings').select('key, value');
  const s: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of data ?? []) s[row.key] = row.value;
  return s as Settings;
}
