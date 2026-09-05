import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, CloudLightning, MapPin, Upload, Wind } from 'lucide-react';
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
import { fmtHours, fmtUtc, fromLocalInput, toLocalInput } from '@/lib/time.ts';
import { cn } from '@/lib/utils.ts';
import { PageSkeleton } from '@/components/ui/skeleton.tsx';

type Meta = { name: string; vessel_id: string; planned_departure: string; tropical_activity_flag: boolean; frontal_activity_flag: boolean; notes: string };
let keySeq = 0;
const newKey = () => `k${++keySeq}`;

export default function PassageBuilder() {
  const { id } = useParams();
  const { data, loading } = usePassage(id);
  const { vessels } = useVessels();
  if (id && loading) return <PageSkeleton variant="map" />;
  if (id && !data) return <div className="p-6 text-sm text-text-2">Passage not found.</div>;
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
  const dest = withEta[withEta.length - 1];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <DisclaimerBar />
      <div className="flex-1 min-h-0 grid lg:grid-cols-[1fr_400px]">
        <div className="relative min-h-[40vh] lg:min-h-[420px]">
          <PassageMap waypoints={withEta.map((w) => ({ id: w.key, sequence: w.sequence, name: w.name, lat: w.lat, lon: w.lon, is_anchorage: w.is_anchorage }))} editable selectedId={selectedKey} showOpenSeaMap={prefs.show_openseamap} onAddPin={addPin} onMovePin={movePin} onSelect={(k) => { setSelectedKey(k); setSheetKey(k); }} />
          <label className="absolute top-2 right-2 z-[1000] rounded-md border border-border bg-bg-1/92 backdrop-blur-sm px-2.5 py-1.5 text-[11px] flex items-center gap-3 cursor-pointer shadow-[0_4px_16px_rgba(0,0,0,0.35)]"><span>OpenSeaMap <span className="text-text-3">crowdsourced, not official</span></span><Switch checked={prefs.show_openseamap} onCheckedChange={(v) => update({ show_openseamap: v })} aria-label="OpenSeaMap overlay" /></label>
          <div className="absolute bottom-2 left-2 z-[1000] rounded-md border border-border bg-bg-1/92 backdrop-blur-sm px-2.5 py-1.5 text-[11px] text-text-2 flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-accent" /> Click the map to drop a pin. Drag pins to move them.</div>
          {withEta.length >= 2 && (
            <div className="absolute bottom-2 right-2 z-[1000] rounded-md border border-border bg-bg-1/92 backdrop-blur-sm px-3 py-1.5 text-[12px] flex items-center gap-2 max-w-[60%]">
              <span className="truncate font-medium">{withEta[0].name || 'WP1'}</span><ArrowRight className="h-3.5 w-3.5 text-text-3 shrink-0" /><span className="truncate font-medium">{dest.name || `WP${dest.sequence}`}</span>
              {preview && <span className="num text-text-3 shrink-0 ml-1">{preview.totalDistanceNm.toFixed(1)} nm</span>}
            </div>
          )}
        </div>
        <aside className="border-l border-border bg-bg-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            <section className="space-y-3">
              <div className="flex items-baseline justify-between"><h1 className="text-[15px] font-semibold">{editing ? 'Edit passage' : 'New passage'}</h1><span className="text-[11px] text-text-3">{editing ? 'changes apply on save' : 'at least two waypoints'}</span></div>
              <div><Label>Passage name</Label><Input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} placeholder="Phuket to Lanta" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Vessel</Label><Select value={vesselId} onChange={(e) => setMeta({ ...meta, vessel_id: e.target.value })}><option value="">—</option>{vessels.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></div>
                <div><Label>Departure (local)</Label><Input type="datetime-local" value={toLocalInput(meta.planned_departure)} onChange={(e) => setMeta({ ...meta, planned_departure: fromLocalInput(e.target.value) ?? meta.planned_departure })} /></div>
              </div>
            </section>
            <section className="space-y-2">
              <div className="label">Manual confidence triggers <span className="normal-case tracking-normal text-text-3/80">· cap the briefing at low</span></div>
              <div className="grid grid-cols-2 gap-2">
                <label className={cn('tile flex items-center justify-between gap-2 px-3 py-2 text-xs cursor-pointer transition-colors hover:border-text-3/50', meta.tropical_activity_flag && 'border-risk-amber/50')}><span className="flex items-center gap-1.5"><CloudLightning className={cn('h-3.5 w-3.5', meta.tropical_activity_flag ? 'text-risk-amber' : 'text-text-3')} /> Tropical</span><Switch checked={meta.tropical_activity_flag} onCheckedChange={(v) => setMeta({ ...meta, tropical_activity_flag: v })} /></label>
                <label className={cn('tile flex items-center justify-between gap-2 px-3 py-2 text-xs cursor-pointer transition-colors hover:border-text-3/50', meta.frontal_activity_flag && 'border-risk-amber/50')}><span className="flex items-center gap-1.5"><Wind className={cn('h-3.5 w-3.5', meta.frontal_activity_flag ? 'text-risk-amber' : 'text-text-3')} /> Frontal</span><Switch checked={meta.frontal_activity_flag} onCheckedChange={(v) => setMeta({ ...meta, frontal_activity_flag: v })} /></label>
              </div>
            </section>
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="label flex-1">Import</div>
                <Button type="button" variant="secondary" size="xs" onClick={() => gpxRef.current?.click()}><Upload className="h-3.5 w-3.5" /> GPX</Button>
                <Button type="button" variant="secondary" size="xs" onClick={() => csvRef.current?.click()}><Upload className="h-3.5 w-3.5" /> CSV</Button>
                <input ref={gpxRef} type="file" accept=".gpx,application/gpx+xml" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onGpx(f); e.target.value = ''; }} />
                <input ref={csvRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onCsv(f); e.target.value = ''; }} />
              </div>
              <p className="text-[11px] text-text-3">GPX routes first, tracks as a fallback. CSV columns: <span className="num text-text-2">name,lat,lon[,is_anchorage,stay_hours]</span></p>
              {notice && <p className="rounded-md border border-risk-amber/40 bg-risk-amber/10 px-2.5 py-1.5 text-xs text-risk-amber">{notice}</p>}
            </section>
            <section className="space-y-2">
              <div className="flex items-baseline justify-between"><div className="label">Waypoints <span className="num text-text-2">({items.length})</span></div><span className="text-[11px] text-text-3">drag to reorder · click for details</span></div>
              <WaypointList items={withEta} selectedKey={selectedKey} onSelect={(k) => { setSelectedKey(k); setSheetKey(k); }} onDelete={del} onReorder={setItems} />
              {!vessel && <p className="text-xs text-risk-amber">Pick a vessel to see ETAs.</p>}
            </section>
          </div>
          <div className="border-t border-border bg-bg-1 p-4 space-y-3">
            {preview && (
              <div className="grid grid-cols-3 gap-2">
                <div><div className="label">Distance</div><div className="num text-[15px] font-medium mt-0.5">{preview.totalDistanceNm.toFixed(1)}<span className="text-[11px] text-text-3 font-sans ml-1">nm</span></div></div>
                <div><div className="label">Time</div><div className="num text-[15px] font-medium mt-0.5">{fmtHours(preview.totalHours)}</div></div>
                <div><div className="label">Arrival</div><div className="num text-[15px] font-medium mt-0.5">{fmtUtc(preview.arrival)}</div></div>
                {preview.errors.length > 0 && <div className="col-span-3 text-xs text-risk-red">{preview.errors.join(', ')}</div>}
              </div>
            )}
            {error && <p className="text-xs text-risk-red">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={() => void save()} disabled={saving} className="flex-1">{saving ? 'Saving…' : editing ? 'Save and plan targets' : 'Create passage'}</Button>
              {editing && <Button variant="ghost" onClick={() => nav(`/passages/${id}`)}>Cancel</Button>}
            </div>
          </div>
        </aside>
      </div>
      <WaypointSheet wp={sheetWp} onChange={(p) => sheetKey && patch(sheetKey, p)} onClose={() => setSheetKey(null)} />
    </div>
  );
}
