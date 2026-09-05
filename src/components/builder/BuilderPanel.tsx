// The passage builder side panel: vessel, departure, triggers, import, waypoint list, Create.
// Used by /passages/new and /passages/:id/edit, and embedded in the weather map's right rail.
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CloudLightning, Upload, Wind } from 'lucide-react';
import type { VesselRow } from '@/types/domain.ts';
import { WaypointList } from './WaypointList.tsx';
import { WaypointSheet } from './WaypointSheet.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Select } from '@/components/ui/select.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { fmtHours, fmtUtc, fromLocalInput, toLocalInput } from '@/lib/time.ts';
import { cn } from '@/lib/utils.ts';
import type { BuilderDraft } from './useBuilderDraft.ts';

type Props = {
  draft: BuilderDraft; vessels: VesselRow[]; id?: string;
  onSaved: (pid: string) => void; onCancel?: () => void;
  /** Set after a save from the weather map: the route stays drawn and the footer offers the Professional view. */
  saved?: { id: string } | null;
  embedded?: boolean; className?: string;
};

export function BuilderPanel({ draft, vessels, id, onSaved, onCancel, saved, embedded, className }: Props) {
  const { editing, meta, setMeta, items, withEta, preview, vessel, vesselId, selectedKey, setSelectedKey, sheetKey, setSheetKey, notice, saving, error, del, patch, setItems, onGpx, onCsv, save } = draft;
  const gpxRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const sheetWp = withEta.find((w) => w.key === sheetKey) ?? null;
  return (
    <div className={cn('flex flex-col min-h-0', className)}>
      <div className={cn('flex-1 overflow-y-auto space-y-5', embedded ? 'p-3' : 'p-4')}>
        <section className="space-y-3">
          <div className="flex items-baseline justify-between"><h2 className="text-[15px] font-semibold">{editing ? 'Edit passage' : embedded ? 'Plan a passage' : 'New passage'}</h2><span className="text-[11px] text-text-3">{editing ? 'changes apply on save' : embedded ? 'tap the map to drop pins' : 'at least two waypoints'}</span></div>
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
      <div className={cn('border-t border-border bg-bg-1 space-y-3', embedded ? 'p-3' : 'p-4')}>
        {preview && (
          <div className="grid grid-cols-3 gap-2">
            <div><div className="label">Distance</div><div className="num text-[15px] font-medium mt-0.5">{preview.totalDistanceNm.toFixed(1)}<span className="text-[11px] text-text-3 font-sans ml-1">nm</span></div></div>
            <div><div className="label">Time</div><div className="num text-[15px] font-medium mt-0.5">{fmtHours(preview.totalHours)}</div></div>
            <div><div className="label">Arrival</div><div className="num text-[15px] font-medium mt-0.5">{fmtUtc(preview.arrival)}</div></div>
            {preview.errors.length > 0 && <div className="col-span-3 text-xs text-risk-red">{preview.errors.join(', ')}</div>}
          </div>
        )}
        {error && <p className="text-xs text-risk-red">{error}</p>}
        {saved ? (
          <div className="flex gap-2">
            <Button asChild className="flex-1"><Link to={`/passages/${saved.id}`}><ArrowUpRight className="h-3.5 w-3.5" /> Open Professional view</Link></Button>
            <Button variant="ghost" asChild><Link to={`/passages/${saved.id}/edit`}>Edit</Link></Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button onClick={() => void save().then((pid) => { if (pid) onSaved(pid); })} disabled={saving} className="flex-1">{saving ? 'Saving…' : editing ? 'Save and plan targets' : 'Create passage'}</Button>
            {(editing || onCancel) && <Button variant="ghost" onClick={onCancel} asChild={!onCancel && editing}>{!onCancel && editing ? <Link to={`/passages/${id}`}>Cancel</Link> : 'Cancel'}</Button>}
          </div>
        )}
      </div>
      <WaypointSheet wp={sheetWp} onChange={(p) => sheetKey && patch(sheetKey, p)} onClose={() => setSheetKey(null)} />
    </div>
  );
}
