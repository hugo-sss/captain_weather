import { Anchor, Mountain } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Select } from '@/components/ui/select.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { Button } from '@/components/ui/button.tsx';
import type { DraftWaypoint, ExposureTag } from '@/types/domain.ts';
import { fromLocalInput, toLocalInput, fmtUtc } from '@/lib/time.ts';
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

/** Per-waypoint sheet: anchorage toggle, stay end, exposure tag, complex-coastal toggle, charted depth (PRD §9.5 screen 1). */
export function WaypointSheet({ wp, onChange, onClose }: Props) {
  if (!wp) return null;
  const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));
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
          <div><Label>Charted depth (m)</Label><Input type="number" step="0.1" value={wp.charted_depth_m ?? ''} placeholder="for UKC" onChange={(e) => onChange({ charted_depth_m: numOrNull(e.target.value) })} /></div>
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
