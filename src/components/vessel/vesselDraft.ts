import type { VesselRow } from '@/types/domain.ts';

export type VesselDraft = {
  name: string; vessel_class: string; length_m: string; beam_m: string; draft_m: string; air_draft_m: string; cruise_speed_kn: string; max_speed_kn: string;
  max_wind_kn: string; max_gust_kn: string; max_wave_m: string; max_current_kn: string; min_ukc_m: string; notes: string;
};

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
export const toDraft = (v: Partial<VesselRow> | null): VesselDraft => ({
  name: s(v?.name), vessel_class: s(v?.vessel_class ?? 'motor'), length_m: s(v?.length_m), beam_m: s(v?.beam_m), draft_m: s(v?.draft_m), air_draft_m: s(v?.air_draft_m),
  cruise_speed_kn: s(v?.cruise_speed_kn), max_speed_kn: s(v?.max_speed_kn), max_wind_kn: s(v?.max_wind_kn), max_gust_kn: s(v?.max_gust_kn), max_wave_m: s(v?.max_wave_m),
  max_current_kn: s(v?.max_current_kn), min_ukc_m: s(v?.min_ukc_m ?? 1.0), notes: s(v?.notes),
});
const n = (v: string): number | null => (v.trim() === '' ? null : Number(v));
export const fromDraft = (d: VesselDraft) => ({
  name: d.name.trim(), vessel_class: d.vessel_class || null, length_m: n(d.length_m), beam_m: n(d.beam_m), draft_m: n(d.draft_m), air_draft_m: n(d.air_draft_m),
  cruise_speed_kn: n(d.cruise_speed_kn) ?? 0, max_speed_kn: n(d.max_speed_kn), max_wind_kn: n(d.max_wind_kn), max_gust_kn: n(d.max_gust_kn), max_wave_m: n(d.max_wave_m),
  max_current_kn: n(d.max_current_kn), min_ukc_m: n(d.min_ukc_m) ?? 1.0, notes: d.notes.trim() || null,
});

