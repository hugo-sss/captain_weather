import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { supabase, invokeFunction } from '@/lib/supabase.ts';
import { usePassage } from '@/hooks/usePassage.ts';
import { useVessels } from '@/hooks/useVessels.ts';
import { useDisplayPrefs } from '@/hooks/useDisplayPrefs.ts';
import { runEngine } from '@/lib/passage-engine/engine.ts';
import { parseGpx, simplify, MAX_WAYPOINTS_BEFORE_SIMPLIFY } from '@/lib/gpx.ts';
import { parseCsv } from '@/lib/csv.ts';
import type { DraftWaypoint, PassageRow, VesselRow, WaypointRow } from '@/types/domain.ts';
import { PassageMap } from '@/components/map/PassageMap.tsx';
import { DisclaimerBar } from '@/components/map/DisclaimerBar.tsx';
import { WaypointList, type ListItem } from '@/components/builder/WaypointList.tsx';
import { WaypointSheet } from '@/components/builder/WaypointSheet.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Select } from '@/components/ui/select.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { fromLocalInput, toLocalInput } from '@/lib/time.ts';
import { fmtHours } from '@/lib/time.ts';

type Meta = { name: string; vessel_id: string; planned_departure: string; tropical_activity_flag: boolean; frontal_activity_flag: boolean; notes: string };
let keySeq = 0;
const newKey = () => `k${++keySeq}`;

export default function PassageBuilder() {
  const { id } = useParams();
  const { data, loading } = usePassage(id);
  const { vessels } = useVessels();
  if (id && (loading || !data)) return <div className="p-4 text-text-2">{loading ? 'Loading passage…' : 'Passage not found.'}</div>;
  // Key on the passage id so the form's own state initialises from the loaded rows exactly once per passage.
  return <BuilderForm key={id ?? 'new'} id={id} passage={data?.passage ?? null} waypoints={data?.waypoints ?? []} vessels={vessels} />;
}

function initialMeta(p: PassageRow | null, vessels: VesselRow[]): Meta {
  if (p) return { name: p.name, vessel_id: p.vessel_id, planned_departure: p.planned_departure, tropical_activity_flag: p.tropical_activity_flag, frontal_activity_flag: p.frontal_activity_flag, notes: p.notes ?? '' };
  return { name: '', vessel_id: vessels[0]?.id ?? '', planned_departure: new Date(Date.now() + 24 * 3_600_000).toISOString(), tropical_activity_flag: false, frontal_activity_flag: false, notes: '' };
}
function initialItems(rows: WaypointRow[]): ListItem[] {
  return rows.map((w) => ({
    key: newKey(), id: w.id, sequence: w.sequence, name: w.name ?? '', lat: Number(w.lat), lon: Number(w.lon), planned_speed_kn: w.planned_speed_kn, is_anchorage: w.is_anchorage,
    planned_departure_from_here: w.planned_departure_from_here, anchorage_exposure_tag: w.anchorage_exposure_tag as DraftWaypoint['anchorage_exposure_tag'], is_complex_coastal: w.is_complex_coastal, charted_depth_m: w.charted_depth_m, source: w.source as DraftWaypoint['source'],
  }));
}

function BuilderForm({ id, passage, waypoints: rows, vessels }: { id: string | undefined; passage: PassageRow | null; waypoints: WaypointRow[]; vessels: VesselRow[] }) {
  const nav = useNavigate();
  const editing = !!id;
  const { prefs, update } = useDisplayPrefs();
  const [meta, setMeta] = useState<Meta>(() => initialMeta(passage, vessels));
  const [items, setItems] = useState<ListItem[]>(() => initialItems(rows));
  const [removed, setRemoved] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [sheetKey, setSheetKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gpxRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const vesselId = meta.vessel_id || vessels[0]?.id || '';

  const vessel = vessels.find((v) => v.id === vesselId) ?? null;

  // Live engine preview so ETAs show while editing.
  const preview = useMemo(() => {
    if (!vessel || items.length === 0) return null;
    return runEngine({ departure: meta.planned_departure, cruiseSpeedKn: Number(vessel.cruise_speed_kn), useCurrent: false, waypoints: items.map((w) => ({ id: w.key, sequence: w.sequence, lat: w.lat, lon: w.lon, plannedSpeedKn: w.planned_speed_kn, isAnchorage: w.is_anchorage, departureFromHere: w.planned_departure_from_here, arrived: false })) });
  }, [items, vessel, meta.planned_departure]);
  const withEta: ListItem[] = useMemo(() => items.map((w) => { const l = preview?.legs.find((x) => x.waypointId === w.key); return { ...w, eta: l?.eta, distanceNm: l?.distanceNm }; }), [items, preview]);

  const addPin = (lat: number, lon: number) => setItems((it) => [...it, { key: newKey(), sequence: it.length + 1, name: `WP${it.length + 1}`, lat, lon, planned_speed_kn: null, is_anchorage: false, planned_departure_from_here: null, anchorage_exposure_tag: null, is_complex_coastal: false, charted_depth_m: null, source: 'map' }]);
  const movePin = (key: string, lat: number, lon: number) => setItems((it) => it.map((w) => (w.key === key ? { ...w, lat, lon } : w)));
  const patch = (key: string, p: Partial<DraftWaypoint>) => setItems((it) => it.map((w) => (w.key === key ? { ...w, ...p } : w)));
  const del = (key: string) => setItems((it) => { const w = it.find((x) => x.key === key); if (w?.id) setRemoved((r) => [...r, w.id!]); return it.filter((x) => x.key !== key).map((x, i) => ({ ...x, sequence: i + 1 })); });
  const replaceAll = (wps: DraftWaypoint[]) => { setRemoved((r) => [...r, ...items.filter((w) => w.id).map((w) => w.id!)]); setItems(wps.map((w) => ({ ...w, key: newKey() }))); };

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

  const save = async () => {
    if (!vesselId) { setError('Pick a vessel first.'); return; }
    if (items.length < 2) { setError('A passage needs at least two waypoints.'); return; }
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
      nav(`/passages/${pid}`);
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  };

  const sheetWp = withEta.find((w) => w.key === sheetKey) ?? null;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <DisclaimerBar />
      <div className="flex-1 min-h-0 grid lg:grid-cols-[1fr_380px]">
        <div className="relative min-h-[40vh] lg:min-h-[360px]">
          <PassageMap waypoints={withEta.map((w) => ({ id: w.key, sequence: w.sequence, name: w.name, lat: w.lat, lon: w.lon, is_anchorage: w.is_anchorage }))} editable selectedId={selectedKey} showOpenSeaMap={prefs.show_openseamap} onAddPin={addPin} onMovePin={movePin} onSelect={(k) => { setSelectedKey(k); setSheetKey(k); }} />
          <div className="absolute top-2 right-2 z-[1000] rounded-md border border-border bg-bg-1/90 px-2 py-1 text-[11px] flex items-center gap-2"><span>OpenSeaMap</span><Switch checked={prefs.show_openseamap} onCheckedChange={(v) => update({ show_openseamap: v })} /></div>
          <div className="absolute bottom-2 left-2 z-[1000] rounded-md border border-border bg-bg-1/90 px-2 py-1 text-[11px] text-text-2">Click the map to drop a pin. Drag pins to move them.</div>
        </div>
        <aside className="border-l border-border bg-bg-1 p-3 overflow-y-auto space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2"><Label>Passage name</Label><Input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} placeholder="Phuket to Lanta" /></div>
            <div><Label>Vessel</Label><Select value={vesselId} onChange={(e) => setMeta({ ...meta, vessel_id: e.target.value })}><option value="">—</option>{vessels.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></div>
            <div><Label>Departure (local)</Label><Input type="datetime-local" value={toLocalInput(meta.planned_departure)} onChange={(e) => setMeta({ ...meta, planned_departure: fromLocalInput(e.target.value) ?? meta.planned_departure })} /></div>
            <label className="flex items-center justify-between rounded-md border border-border px-2 py-1.5 text-xs"><span>Tropical activity</span><Switch checked={meta.tropical_activity_flag} onCheckedChange={(v) => setMeta({ ...meta, tropical_activity_flag: v })} /></label>
            <label className="flex items-center justify-between rounded-md border border-border px-2 py-1.5 text-xs"><span>Frontal activity</span><Switch checked={meta.frontal_activity_flag} onCheckedChange={(v) => setMeta({ ...meta, frontal_activity_flag: v })} /></label>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => gpxRef.current?.click()}><Upload className="h-3.5 w-3.5" /> GPX</Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => csvRef.current?.click()}><Upload className="h-3.5 w-3.5" /> CSV</Button>
            <input ref={gpxRef} type="file" accept=".gpx,application/gpx+xml" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onGpx(f); e.target.value = ''; }} />
            <input ref={csvRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onCsv(f); e.target.value = ''; }} />
            <span className="text-[11px] text-text-3 self-center">CSV: name,lat,lon[,is_anchorage,stay_hours]</span>
          </div>
          {notice && <p className="text-xs text-risk-amber">{notice}</p>}
          <div>
            <div className="label mb-1">Waypoints ({items.length}) · drag to reorder · click for details</div>
            <WaypointList items={withEta} selectedKey={selectedKey} onSelect={(k) => { setSelectedKey(k); setSheetKey(k); }} onDelete={del} onReorder={setItems} />
          </div>
          {preview && (
            <div className="text-xs text-text-2 num flex gap-4">
              <span>{preview.totalDistanceNm.toFixed(1)} nm</span><span>{fmtHours(preview.totalHours)}</span><span>arr {preview.arrival.slice(0, 16).replace('T', ' ')}Z</span>
              {preview.errors.length > 0 && <span className="text-risk-red">{preview.errors.join(', ')}</span>}
            </div>
          )}
          {!vessel && <p className="text-xs text-risk-amber">Pick a vessel to see ETAs.</p>}
          {error && <p className="text-xs text-risk-red">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : editing ? 'Save and plan targets' : 'Create passage'}</Button>
            {editing && <Button variant="ghost" onClick={() => nav(`/passages/${id}`)}>Cancel</Button>}
          </div>
        </aside>
      </div>
      <WaypointSheet wp={sheetWp} onChange={(p) => sheetKey && patch(sheetKey, p)} onClose={() => setSheetKey(null)} />
    </div>
  );
}
