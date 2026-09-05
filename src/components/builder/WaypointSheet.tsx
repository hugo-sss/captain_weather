import { useState } from 'react';
import { Anchor, Grid2x2, Mountain, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Select } from '@/components/ui/select.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { Button } from '@/components/ui/button.tsx';
import { DepthSourceChip } from '@/components/dashboard/DepthSourceChip.tsx';
import type { DraftWaypoint, ExposureTag } from '@/types/domain.ts';
import { fromLocalInput, toLocalInput, fmtUtc } from '@/lib/time.ts';
import { suggestGebcoDepth } from '@/lib/gebco-source.ts';
import type { GebcoSuggestion } from '@/lib/gebco.ts';
import { cn } from '@/lib/utils.ts';

type Props = { wp: (DraftWaypoint & { key: string; eta?: string }) | null; onChange: (patch: Partial<DraftWaypoint>) => void; onClose: () => void };

function ToggleRow({ icon, title, hint, checked, onChange, className }: { icon: React.ReactNode; title: string; hint: string; checked: boolean; onChange: (v: boolean) => void; className?: string }) {
  return (
    <label className={cn('tile flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:border-text-3/50', checked && 'border-accent/50', className)}>
      <span className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border', checked ? 'border-accent/40 bg-accent/12 text-accent' : 'border-border bg-bg-1 text-text-3')}>{icon}</span>
      <span className="flex-1 min-w-0"><span className="block text-sm">{title}</span><span className="block text-[11px] text-text-3">{hint}</span></span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

/**
 * Depth prompt for anchorages and complex-coastal waypoints with no charted depth: a GEBCO grid value can be
 * suggested (keyless, 1 request/s) and is only ever applied when the user clicks Accept. It is saved with
 * charted_depth_source = 'gebco' and shown everywhere with the "GEBCO grid, verify on chart" chip.
 */
function DepthPrompt({ lat, lon, onAccept }: { lat: number; lon: number; onAccept: (s: GebcoSuggestion) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sug, setSug] = useState<GebcoSuggestion | null | 'none'>(null);
  const run = async () => {
    setBusy(true); setError(null);
    try { const r = await suggestGebcoDepth(lat, lon); setSug(r ?? 'none'); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <div className="col-span-2 rounded-md border border-risk-amber/40 bg-risk-amber/10 px-3 py-2.5 text-xs space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-risk-amber">Depth needed for UKC</span>
        <span className="text-text-2">No charted depth here, so the under-keel clearance estimate stays empty.</span>
        <Button type="button" size="xs" variant="secondary" className="ml-auto" onClick={() => void run()} disabled={busy}>{busy ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Grid2x2 className="h-3 w-3" />} Suggest from GEBCO</Button>
      </div>
      {error && <p className="text-risk-red">{error}</p>}
      {sug === 'none' && <p className="text-text-2">The GEBCO grid has no water depth at this position (land or no value). Enter the charted depth by hand.</p>}
      {sug && sug !== 'none' && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-bg-1 px-2.5 py-2">
          <span className="num text-[15px] font-medium text-text-1">{sug.depthM.toFixed(1)}<span className="font-sans text-[11px] text-text-3 ml-1">m</span></span>
          <span className="text-text-3">GEBCO 2020 grid value at <span className="num">{sug.lat.toFixed(4)}, {sug.lon.toFixed(4)}</span> (elevation <span className="num">{sug.elevationM.toFixed(1)} m</span>). About 450 m cells, not a charted sounding.</span>
          <Button type="button" size="xs" className="ml-auto" onClick={() => onAccept(sug)}>Accept as GEBCO depth</Button>
        </div>
      )}
    </div>
  );
}

/** Per-waypoint sheet: anchorage toggle, stay end, exposure tag, complex-coastal toggle, charted depth (PRD §9.5 screen 1). */
export function WaypointSheet({ wp, onChange, onClose }: Props) {
  if (!wp) return null;
  return <SheetBody key={wp.key} wp={wp} onChange={onChange} onClose={onClose} />;
}

function SheetBody({ wp, onChange, onClose }: { wp: NonNullable<Props['wp']>; onChange: Props['onChange']; onClose: () => void }) {
  const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));
  const needsDepth = (wp.is_anchorage || wp.is_complex_coastal) && wp.charted_depth_m === null;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl">
        <div className="flex items-start gap-3 pr-8">
          <span className="num inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-bg-2 text-sm text-text-1">{wp.sequence}</span>
          <div className="min-w-0">
            <DialogTitle>{wp.name || `Waypoint ${wp.sequence}`}</DialogTitle>
            <DialogDescription className="num">{wp.lat.toFixed(4)}, {wp.lon.toFixed(4)}{wp.eta ? ` · ETA ${fmtUtc(wp.eta)}` : ''}</DialogDescription>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="col-span-2"><Label>Name</Label><Input value={wp.name} onChange={(e) => onChange({ name: e.target.value })} /></div>
          <div><Label>Latitude</Label><Input type="number" step="0.0001" value={wp.lat} onChange={(e) => onChange({ lat: Number(e.target.value) })} /></div>
          <div><Label>Longitude</Label><Input type="number" step="0.0001" value={wp.lon} onChange={(e) => onChange({ lon: Number(e.target.value) })} /></div>
          <div><Label>Speed for the leg to here (kn)</Label><Input type="number" step="0.1" value={wp.planned_speed_kn ?? ''} placeholder="vessel cruise speed" onChange={(e) => onChange({ planned_speed_kn: numOrNull(e.target.value) })} /></div>
          <div>
            <Label className="flex items-center gap-2">Charted depth (m) <DepthSourceChip source={wp.charted_depth_source} /></Label>
            <Input type="number" step="0.1" value={wp.charted_depth_m ?? ''} placeholder="for UKC" onChange={(e) => { const d = numOrNull(e.target.value); onChange({ charted_depth_m: d, charted_depth_source: d === null ? null : 'user' }); }} />
          </div>
          {needsDepth && <DepthPrompt lat={wp.lat} lon={wp.lon} onAccept={(s) => onChange({ charted_depth_m: s.depthM, charted_depth_source: 'gebco' })} />}
          <ToggleRow className="col-span-2" icon={<Anchor className="h-3.5 w-3.5" />} title="Anchorage" hint="Defines a stay window; the next leg departs at the stay end." checked={wp.is_anchorage}
            onChange={(v) => onChange({ is_anchorage: v, planned_departure_from_here: v ? wp.planned_departure_from_here ?? (wp.eta ? new Date(Date.parse(wp.eta) + 12 * 3_600_000).toISOString() : null) : null })} />
          {wp.is_anchorage && (
            <>
              <div><Label>Stay end (local time)</Label><Input type="datetime-local" value={toLocalInput(wp.planned_departure_from_here)} onChange={(e) => onChange({ planned_departure_from_here: fromLocalInput(e.target.value) })} /></div>
              <div><Label>Exposure (manual in v1)</Label><Select value={wp.anchorage_exposure_tag ?? ''} onChange={(e) => onChange({ anchorage_exposure_tag: (e.target.value || null) as ExposureTag | null })}><option value="">not set</option><option value="sheltered">sheltered</option><option value="partial">partial</option><option value="exposed">exposed</option></Select></div>
            </>
          )}
          <ToggleRow className="col-span-2" icon={<Mountain className="h-3.5 w-3.5" />} title="Complex coastal terrain" hint="Manual confidence trigger: caps confidence at moderate." checked={wp.is_complex_coastal} onChange={(v) => onChange({ is_complex_coastal: v })} />
        </div>
        <div className="mt-4 flex justify-end"><Button size="sm" onClick={onClose}>Done</Button></div>
      </DialogContent>
    </Dialog>
  );
}
