// The passage builder side panel: name, vessel, departure, waypoints, an Advanced disclosure, save.
// Used by /passages/new and /passages/:id/edit, and embedded in the weather map's right rail.
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ChevronDown, CloudLightning, Upload, Wind } from 'lucide-react';
import type { VesselRow } from '@/types/domain.ts';
import { WaypointList } from './WaypointList.tsx';
import { WaypointSheet } from './WaypointSheet.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Select } from '@/components/ui/select.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { Stat } from '@/components/ui/stat.tsx';
import { useDisplayPrefs } from '@/hooks/useDisplayPrefs.ts';
import { fromLocalInput, toLocalInput } from '@/lib/time.ts';
import { distancePhrase, durationPhrase, localDateTime } from '@/lib/plain.ts';
import { cn } from '@/lib/utils.ts';
import type { BuilderDraft } from './useBuilderDraft.ts';

type Props = {
  draft: BuilderDraft; vessels: VesselRow[]; id?: string;
  onSaved: (pid: string) => void; onCancel?: () => void;
  /** Set after a save from the weather map: the route stays drawn and the footer offers the passage page. */
  saved?: { id: string } | null;
  embedded?: boolean; className?: string;
};

export function BuilderPanel({ draft, vessels, id, onSaved, onCancel, saved, embedded, className }: Props) {
  const { editing, meta, setMeta, items, withEta, preview, vessel, vesselId, selectedKey, setSelectedKey, sheetKey, setSheetKey, notice, saving, error, del, patch, setItems, onGpx, onCsv, save } = draft;
  const { prefs } = useDisplayPrefs();
  const gpxRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const sheetWp = withEta.find((w) => w.key === sheetKey) ?? null;
  return (
    <div className={cn('flex flex-col min-h-0', className)}>
      <div className={cn('flex-1 overflow-y-auto space-y-6', embedded ? 'p-4' : 'p-5')}>
        <section className="space-y-3">
          <div>
            <h2 className={embedded ? 't-card' : 't-section'}>{editing ? 'Edit route' : embedded ? 'Plan a passage' : 'New passage'}</h2>
            <p className="t-caption mt-0.5">{editing ? 'Changes apply when you save.' : embedded ? 'Tap the map to drop pins.' : 'A passage needs at least two waypoints.'}</p>
          </div>
          <div><Label htmlFor="passage-name">Passage name</Label><Input id="passage-name" value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} placeholder="Phuket to Ko Lanta" /></div>
          <div className="grid grid-cols-1 gap-3">
            <div><Label htmlFor="passage-vessel">Vessel</Label><Select id="passage-vessel" value={vesselId} onChange={(e) => setMeta({ ...meta, vessel_id: e.target.value })}><option value="">Choose</option>{vessels.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></div>
            <div><Label htmlFor="passage-departure">Departure, local time</Label><Input id="passage-departure" type="datetime-local" value={toLocalInput(meta.planned_departure)} onChange={(e) => setMeta({ ...meta, planned_departure: fromLocalInput(e.target.value) ?? meta.planned_departure })} /></div>
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1"><div className="t-card">Waypoints <span className="num t-caption font-normal">({items.length})</span></div><div className="t-caption">Drag to reorder, tap one for details.</div></div>
            <Button type="button" variant="secondary" size="sm" onClick={() => gpxRef.current?.click()}><Upload /> GPX</Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => csvRef.current?.click()}><Upload /> CSV</Button>
            <input ref={gpxRef} type="file" accept=".gpx,application/gpx+xml" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onGpx(f); e.target.value = ''; }} />
            <input ref={csvRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onCsv(f); e.target.value = ''; }} />
          </div>
          {notice && <p className="rounded-lg bg-risk-amber/10 px-3 py-2 text-[12px] text-risk-amber">{notice}</p>}
          <WaypointList items={withEta} selectedKey={selectedKey} onSelect={(k) => { setSelectedKey(k); setSheetKey(k); }} onDelete={del} onReorder={setItems} utcOffsetMin={prefs.local_utc_offset_min} />
          {!vessel && <p className="text-[12px] text-risk-amber">Choose a vessel to see ETAs.</p>}
        </section>

        <details className="disclosure">
          <summary className="flex items-center gap-2 text-[13px] font-medium text-text-2 hover:text-text-1"><ChevronDown className="chev h-4 w-4 transition-transform" /> Advanced</summary>
          <div className="mt-3 space-y-4">
            <div>
              <div className="label mb-1.5">Manual confidence triggers</div>
              <p className="t-caption mb-2">Switch one on when you know about it. Either caps the briefing confidence at low.</p>
              <div className="grid grid-cols-2 gap-2">
                <label className={cn('tile flex items-center justify-between gap-2 px-3 py-2.5 text-[13px] cursor-pointer', meta.tropical_activity_flag && 'ring-1 ring-risk-amber/50')}><span className="flex items-center gap-1.5"><CloudLightning className={cn('h-4 w-4', meta.tropical_activity_flag ? 'text-risk-amber' : 'text-text-3')} /> Tropical activity</span><Switch checked={meta.tropical_activity_flag} onCheckedChange={(v) => setMeta({ ...meta, tropical_activity_flag: v })} /></label>
                <label className={cn('tile flex items-center justify-between gap-2 px-3 py-2.5 text-[13px] cursor-pointer', meta.frontal_activity_flag && 'ring-1 ring-risk-amber/50')}><span className="flex items-center gap-1.5"><Wind className={cn('h-4 w-4', meta.frontal_activity_flag ? 'text-risk-amber' : 'text-text-3')} /> Frontal activity</span><Switch checked={meta.frontal_activity_flag} onCheckedChange={(v) => setMeta({ ...meta, frontal_activity_flag: v })} /></label>
              </div>
            </div>
            <p className="t-caption">GPX: routes first, tracks as a fallback. CSV columns: <span className="num text-text-1">name, lat, lon</span> and optionally <span className="num text-text-1">is_anchorage, stay_hours</span>.</p>
          </div>
        </details>
      </div>
      <div className={cn('border-t border-border-soft bg-bg-1 space-y-4', embedded ? 'p-4' : 'p-5')}>
        {preview && (
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Distance" value={<span className="num">{distancePhrase(preview.totalDistanceNm)}</span>} />
            <Stat label="Under way" value={<span className="num">{durationPhrase(preview.totalHours)}</span>} />
            <Stat label="Arrival" value={<span className="num">{localDateTime(preview.arrival, prefs.local_utc_offset_min)}</span>} sub="Local time" className="col-span-2" />
            {preview.errors.length > 0 && <div className="col-span-3 text-[12px] text-risk-red">{preview.errors.join(', ')}</div>}
          </div>
        )}
        {error && <p className="text-[12px] text-risk-red">{error}</p>}
        {saved ? (
          <div className="flex gap-2">
            <Button asChild className="flex-1"><Link to={`/passages/${saved.id}`}><ArrowUpRight /> Open the passage</Link></Button>
            <Button variant="ghost" asChild><Link to={`/passages/${saved.id}/edit`}>Edit</Link></Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button onClick={() => void save().then((pid) => { if (pid) onSaved(pid); })} loading={saving} className="flex-1">{saving ? 'Saving…' : editing ? 'Save route' : 'Create passage'}</Button>
            {(editing || onCancel) && <Button variant="ghost" onClick={onCancel} asChild={!onCancel && editing}>{!onCancel && editing ? <Link to={`/passages/${id}`}>Cancel</Link> : 'Cancel'}</Button>}
          </div>
        )}
      </div>
      <WaypointSheet wp={sheetWp} onChange={(p) => sheetKey && patch(sheetKey, p)} onClose={() => setSheetKey(null)} />
    </div>
  );
}
