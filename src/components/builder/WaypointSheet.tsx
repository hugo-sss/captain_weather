import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Select } from '@/components/ui/select.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import type { DraftWaypoint, ExposureTag } from '@/types/domain.ts';
import { fromLocalInput, toLocalInput } from '@/lib/time.ts';

type Props = { wp: (DraftWaypoint & { key: string; eta?: string }) | null; onChange: (patch: Partial<DraftWaypoint>) => void; onClose: () => void };

/** Per-waypoint sheet: anchorage toggle, stay end, exposure tag, complex-coastal toggle, charted depth (PRD §9.5 screen 1). */
export function WaypointSheet({ wp, onChange, onClose }: Props) {
  if (!wp) return null;
  const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogTitle>Waypoint {wp.sequence}</DialogTitle>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="col-span-2"><Label>Name</Label><Input value={wp.name} onChange={(e) => onChange({ name: e.target.value })} /></div>
          <div><Label>Latitude</Label><Input type="number" step="0.0001" value={wp.lat} onChange={(e) => onChange({ lat: Number(e.target.value) })} /></div>
          <div><Label>Longitude</Label><Input type="number" step="0.0001" value={wp.lon} onChange={(e) => onChange({ lon: Number(e.target.value) })} /></div>
          <div><Label>Planned speed for the leg TO this waypoint (kn)</Label><Input type="number" step="0.1" value={wp.planned_speed_kn ?? ''} placeholder="vessel cruise speed" onChange={(e) => onChange({ planned_speed_kn: numOrNull(e.target.value) })} /></div>
          <div><Label>Charted depth (m)</Label><Input type="number" step="0.1" value={wp.charted_depth_m ?? ''} onChange={(e) => onChange({ charted_depth_m: numOrNull(e.target.value) })} /></div>
          <div className="col-span-2 flex items-center justify-between rounded-md border border-border p-2">
            <div><div className="text-sm">Anchorage</div><div className="text-[11px] text-text-3">Defines a stay window; the next leg departs at the stay end.</div></div>
            <Switch checked={wp.is_anchorage} onCheckedChange={(v) => onChange({ is_anchorage: v, planned_departure_from_here: v ? wp.planned_departure_from_here ?? (wp.eta ? new Date(Date.parse(wp.eta) + 12 * 3_600_000).toISOString() : null) : null })} />
          </div>
          {wp.is_anchorage && (
            <>
              <div className="col-span-2"><Label>Stay end (local time)</Label><Input type="datetime-local" value={toLocalInput(wp.planned_departure_from_here)} onChange={(e) => onChange({ planned_departure_from_here: fromLocalInput(e.target.value) })} />{wp.eta && <div className="text-[11px] text-text-3 mt-1">ETA here {new Date(wp.eta).toISOString().slice(0, 16).replace('T', ' ')}Z</div>}</div>
              <div className="col-span-2"><Label>Exposure (manual in v1)</Label><Select value={wp.anchorage_exposure_tag ?? ''} onChange={(e) => onChange({ anchorage_exposure_tag: (e.target.value || null) as ExposureTag | null })}><option value="">not set</option><option value="sheltered">sheltered</option><option value="partial">partial</option><option value="exposed">exposed</option></Select></div>
            </>
          )}
          <div className="col-span-2 flex items-center justify-between rounded-md border border-border p-2">
            <div><div className="text-sm">Complex coastal terrain</div><div className="text-[11px] text-text-3">Manual confidence trigger: caps confidence at moderate.</div></div>
            <Switch checked={wp.is_complex_coastal} onCheckedChange={(v) => onChange({ is_complex_coastal: v })} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
