// Passage draft state shared by the builder page and the weather map's "Plan a passage" rail.
// Extracted verbatim from PassageBuilder so both surfaces run the same import, engine preview and save.
import { useCallback, useMemo, useState } from 'react';
import { supabase, invokeFunction } from '@/lib/supabase.ts';
import { runEngine } from '@/lib/passage-engine/engine.ts';
import { parseGpx, simplify, MAX_WAYPOINTS_BEFORE_SIMPLIFY } from '@/lib/gpx.ts';
import { parseCsv } from '@/lib/csv.ts';
import type { DraftWaypoint, PassageRow, VesselRow, WaypointRow } from '@/types/domain.ts';
import type { ListItem } from './WaypointList.tsx';

export type Meta = { name: string; vessel_id: string; planned_departure: string; tropical_activity_flag: boolean; frontal_activity_flag: boolean; notes: string };
let keySeq = 0;
const newKey = () => `k${++keySeq}`;

export function initialMeta(p: PassageRow | null, vessels: VesselRow[]): Meta {
  if (p) return { name: p.name, vessel_id: p.vessel_id, planned_departure: p.planned_departure, tropical_activity_flag: p.tropical_activity_flag, frontal_activity_flag: p.frontal_activity_flag, notes: p.notes ?? '' };
  return { name: '', vessel_id: vessels[0]?.id ?? '', planned_departure: new Date(Date.now() + 24 * 3_600_000).toISOString(), tropical_activity_flag: false, frontal_activity_flag: false, notes: '' };
}
export function initialItems(rows: WaypointRow[]): ListItem[] {
  return rows.map((w) => ({
    key: newKey(), id: w.id, sequence: w.sequence, name: w.name ?? '', lat: Number(w.lat), lon: Number(w.lon), planned_speed_kn: w.planned_speed_kn, is_anchorage: w.is_anchorage,
    planned_departure_from_here: w.planned_departure_from_here, anchorage_exposure_tag: w.anchorage_exposure_tag as DraftWaypoint['anchorage_exposure_tag'], is_complex_coastal: w.is_complex_coastal, charted_depth_m: w.charted_depth_m, source: w.source as DraftWaypoint['source'],
  }));
}

export function useBuilderDraft({ id, passage, waypoints: rows, vessels }: { id?: string; passage: PassageRow | null; waypoints: WaypointRow[]; vessels: VesselRow[] }) {
  const editing = !!id;
  const [meta, setMeta] = useState<Meta>(() => initialMeta(passage, vessels));
  const [items, setItems] = useState<ListItem[]>(() => initialItems(rows));
  const [removed, setRemoved] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [sheetKey, setSheetKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const vesselId = meta.vessel_id || vessels[0]?.id || '';
  const vessel = vessels.find((v) => v.id === vesselId) ?? null;

  // Live engine preview so ETAs show while editing.
  const preview = useMemo(() => {
    if (!vessel || items.length === 0) return null;
    return runEngine({ departure: meta.planned_departure, cruiseSpeedKn: Number(vessel.cruise_speed_kn), useCurrent: false, waypoints: items.map((w) => ({ id: w.key, sequence: w.sequence, lat: w.lat, lon: w.lon, plannedSpeedKn: w.planned_speed_kn, isAnchorage: w.is_anchorage, departureFromHere: w.planned_departure_from_here, arrived: false })) });
  }, [items, vessel, meta.planned_departure]);
  const withEta: ListItem[] = useMemo(() => items.map((w) => { const l = preview?.legs.find((x) => x.waypointId === w.key); return { ...w, eta: l?.eta, distanceNm: l?.distanceNm }; }), [items, preview]);

  const addPin = useCallback((lat: number, lon: number) => setItems((it) => [...it, { key: newKey(), sequence: it.length + 1, name: `WP${it.length + 1}`, lat, lon, planned_speed_kn: null, is_anchorage: false, planned_departure_from_here: null, anchorage_exposure_tag: null, is_complex_coastal: false, charted_depth_m: null, source: 'map' }]), []);
  const movePin = useCallback((key: string, lat: number, lon: number) => setItems((it) => it.map((w) => (w.key === key ? { ...w, lat, lon } : w))), []);
  const patch = useCallback((key: string, p: Partial<DraftWaypoint>) => setItems((it) => it.map((w) => (w.key === key ? { ...w, ...p } : w))), []);
  const del = useCallback((key: string) => setItems((it) => { const w = it.find((x) => x.key === key); if (w?.id) setRemoved((r) => [...r, w.id!]); return it.filter((x) => x.key !== key).map((x, i) => ({ ...x, sequence: i + 1 })); }), []);
  const replaceAll = useCallback((wps: DraftWaypoint[]) => { setRemoved((r) => [...r, ...items.filter((w) => w.id).map((w) => w.id!)]); setItems(wps.map((w) => ({ ...w, key: newKey() }))); }, [items]);
  const reset = useCallback(() => { setItems([]); setRemoved([]); setSelectedKey(null); setSheetKey(null); setNotice(null); setError(null); setMeta(initialMeta(null, vessels)); }, [vessels]);

  const onGpx = async (f: File) => {
    try {
      const r = parseGpx(await f.text());
      let wps = r.waypoints;
      let n = r.notice;
      if (wps.length > MAX_WAYPOINTS_BEFORE_SIMPLIFY && window.confirm(`${wps.length} points. Simplify with Douglas-Peucker?`)) { wps = simplify(wps); n = `${n ?? ''} Simplified to ${wps.length} points.`.trim(); }
      if (wps.length === 0) { setNotice(n); return; }
      replaceAll(wps); setNotice(n);
    } catch (e) { setError((e as Error).message); }
  };
  const onCsv = async (f: File) => {
    const r = parseCsv(await f.text());
    if (r.waypoints.length) {
      // stay_hours -> stay end = engine ETA + hours (engine runs at the vessel cruise speed; ETAs refine on save).
      let wps = r.waypoints as (DraftWaypoint & { stay_hours?: number })[];
      if (vessel) {
        const e = runEngine({ departure: meta.planned_departure, cruiseSpeedKn: Number(vessel.cruise_speed_kn), useCurrent: false, waypoints: wps.map((w, i) => ({ id: String(i), sequence: w.sequence, lat: w.lat, lon: w.lon, plannedSpeedKn: w.planned_speed_kn, isAnchorage: false, arrived: false })) });
        wps = wps.map((w, i) => { const eta = e.legs.find((l) => l.waypointId === String(i))?.eta; return w.is_anchorage && w.stay_hours && eta ? { ...w, planned_departure_from_here: new Date(Date.parse(eta) + w.stay_hours * 3_600_000).toISOString() } : w; });
      }
      replaceAll(wps);
    }
    setNotice(r.errors.length ? r.errors.join('; ') : null);
  };

  /** Saves passage + waypoints, plans targets, resolves with the passage id (or null on error). */
  const save = async (): Promise<string | null> => {
    if (!vesselId) { setError('Pick a vessel first.'); return null; }
    if (items.length < 2) { setError('A passage needs at least two waypoints.'); return null; }
    setSaving(true); setError(null);
    try {
      const payload = { name: meta.name.trim() || 'Untitled passage', vessel_id: vesselId, planned_departure: meta.planned_departure, tropical_activity_flag: meta.tropical_activity_flag, frontal_activity_flag: meta.frontal_activity_flag, notes: meta.notes || null };
      const res = editing ? await supabase.from('passages').update(payload).eq('id', id!).select('id').single() : await supabase.from('passages').insert(payload).select('id').single();
      if (res.error) throw res.error;
      const pid = res.data.id;
      if (removed.length) { const d = await supabase.from('waypoints').delete().in('id', removed); if (d.error) throw d.error; }
      // One request = one transaction, so renumbered sequences pass the deferred unique constraint together.
      const rows = items.map((w) => ({ ...(w.id ? { id: w.id } : {}), passage_id: pid, sequence: w.sequence, name: w.name || null, lat: w.lat, lon: w.lon, planned_speed_kn: w.planned_speed_kn, is_anchorage: w.is_anchorage, planned_departure_from_here: w.is_anchorage ? w.planned_departure_from_here : null, anchorage_exposure_tag: w.is_anchorage ? w.anchorage_exposure_tag : null, is_complex_coastal: w.is_complex_coastal, charted_depth_m: w.charted_depth_m, source: w.source }));
      const up = await supabase.from('waypoints').upsert(rows, { onConflict: 'id' });
      if (up.error) throw up.error;
      try { await invokeFunction('plan-targets', { passage_id: pid }); } catch (e) { setNotice(`Saved. Target planning failed: ${(e as Error).message}`); }
      return pid as string;
    } catch (e) { setError((e as Error).message); return null; } finally { setSaving(false); }
  };

  return { editing, meta, setMeta, items, setItems, withEta, preview, vessel, vesselId, selectedKey, setSelectedKey, sheetKey, setSheetKey, notice, saving, error, setError, addPin, movePin, patch, del, replaceAll, reset, onGpx, onCsv, save };
}

export type BuilderDraft = ReturnType<typeof useBuilderDraft>;
