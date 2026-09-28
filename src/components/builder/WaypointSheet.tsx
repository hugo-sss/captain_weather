import { useState } from 'react';
import { Anchor, Grid2x2, Mountain, Waves } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Select } from '@/components/ui/select.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { Button } from '@/components/ui/button.tsx';
import { DepthSourceChip } from '@/components/dashboard/DepthSourceChip.tsx';
import { useDisplayPrefs } from '@/hooks/useDisplayPrefs.ts';
import type { DraftWaypoint, ExposureTag } from '@/types/domain.ts';
import { fromLocalInput, toLocalInput } from '@/lib/time.ts';
import { localDateTime, streamPhrase } from '@/lib/plain.ts';
import { suggestGebcoDepth } from '@/lib/gebco-source.ts';
import type { GebcoSuggestion } from '@/lib/gebco.ts';
import { cn } from '@/lib/utils.ts';

type Props = { wp: (DraftWaypoint & { key: string; eta?: string; streamDeltaMin?: number | null }) | null; onChange: (patch: Partial<DraftWaypoint>) => void; onClose: () => void };

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="t-card">{title}{hint && <span className="block t-caption font-normal mt-0.5">{hint}</span>}</legend>
      {children}
    </fieldset>
  );
}

function ToggleRow({ icon, title, hint, checked, onChange }: { icon: React.ReactNode; title: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={cn('tile flex items-center gap-3 px-3.5 py-3 cursor-pointer transition-colors', checked && 'ring-1 ring-accent/50')}>
      <span className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', checked ? 'bg-accent/12 text-accent' : 'bg-bg-1 text-text-3')}>{icon}</span>
      <span className="flex-1 min-w-0"><span className="block text-[14px] font-medium">{title}</span><span className="block t-caption">{hint}</span></span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

/**
 * Depth prompt for anchorages and complex-coastal waypoints with no charted depth: a GEBCO grid value can be
 * suggested (keyless, 1 request/s) and is only ever applied when the user clicks Accept. It is saved with
 * charted_depth_source = 'gebco' and shown everywhere with the "Verify on chart" chip.
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
    <div className="rounded-lg bg-risk-amber/10 px-3.5 py-3 text-[13px] space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-text-1">No charted depth here, so clearance under the keel stays empty.</span>
        <Button type="button" size="xs" variant="secondary" className="ml-auto" onClick={() => void run()} loading={busy}>{!busy && <Grid2x2 />} Suggest from GEBCO</Button>
      </div>
      {error && <p className="text-risk-red">{error}</p>}
      {sug === 'none' && <p className="text-text-2">The GEBCO grid has no water depth at this position (land or no value). Enter the charted depth by hand.</p>}
      {sug && sug !== 'none' && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-bg-1 px-3 py-2">
          <span className="num text-[15px] font-medium text-text-1">{sug.depthM.toFixed(1)}<span className="font-sans text-[11px] text-text-3 ml-1">m</span></span>
          <span className="text-text-3 text-[12px]">GEBCO 2020 grid value at <span className="num">{sug.lat.toFixed(4)}, {sug.lon.toFixed(4)}</span>. About 450 m cells, not a charted sounding.</span>
          <Button type="button" size="xs" className="ml-auto" onClick={() => onAccept(sug)}>Accept as grid depth</Button>
        </div>
      )}
    </div>
  );
}

/** Per-waypoint sheet: Position, Anchorage, Depth, Notes (PRD §9.5 screen 1). */
export function WaypointSheet({ wp, onChange, onClose }: Props) {
  if (!wp) return null;
  return <SheetBody key={wp.key} wp={wp} onChange={onChange} onClose={onClose} />;
}

function SheetBody({ wp, onChange, onClose }: { wp: NonNullable<Props['wp']>; onChange: Props['onChange']; onClose: () => void }) {
  const { prefs } = useDisplayPrefs();
  const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));
  const needsDepth = (wp.is_anchorage || wp.is_complex_coastal) && wp.charted_depth_m === null;
  const [refresh, setRefresh] = useState(0);
  void refresh;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl">
        <div className="flex items-start gap-3 pr-8">
          <span className="num inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-2 text-[13px] text-text-1">{wp.sequence}</span>
          <div className="min-w-0">
            <DialogTitle>{wp.name || `Waypoint ${wp.sequence}`}</DialogTitle>
            <DialogDescription><span className="num">{wp.lat.toFixed(4)}, {wp.lon.toFixed(4)}</span>{wp.eta ? ` · arrive ${localDateTime(wp.eta, prefs.local_utc_offset_min)} local` : ''}</DialogDescription>
          </div>
        </div>
        <div className="mt-5 space-y-6">
          <Group title="Position">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Name</Label><Input value={wp.name} onChange={(e) => onChange({ name: e.target.value })} /></div>
              <div><Label>Latitude</Label><Input type="number" step="0.0001" value={wp.lat} onChange={(e) => onChange({ lat: Number(e.target.value) })} /></div>
              <div><Label>Longitude</Label><Input type="number" step="0.0001" value={wp.lon} onChange={(e) => onChange({ lon: Number(e.target.value) })} /></div>
              <div className="col-span-2"><Label>Speed on the leg to here (kn)</Label><Input type="number" step="0.1" value={wp.planned_speed_kn ?? ''} placeholder="Vessel cruise speed" onChange={(e) => onChange({ planned_speed_kn: numOrNull(e.target.value) })} /></div>
            </div>
          </Group>
          <Group title="Anchorage" hint="An anchorage has a stay window; the next leg departs at its end.">
            <ToggleRow icon={<Anchor className="h-4 w-4" />} title="Stop here at anchor" hint="Adds a stay window and a stay summary with tide range and clearance." checked={wp.is_anchorage}
              onChange={(v) => { onChange({ is_anchorage: v, planned_departure_from_here: v ? wp.planned_departure_from_here ?? (wp.eta ? new Date(Date.parse(wp.eta) + 12 * 3_600_000).toISOString() : null) : null }); setRefresh((r) => r + 1); }} />
            {wp.is_anchorage && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Stay ends, local time</Label><Input type="datetime-local" value={toLocalInput(wp.planned_departure_from_here)} onChange={(e) => onChange({ planned_departure_from_here: fromLocalInput(e.target.value) })} /></div>
                <div><Label>Exposure</Label><Select value={wp.anchorage_exposure_tag ?? ''} onChange={(e) => onChange({ anchorage_exposure_tag: (e.target.value || null) as ExposureTag | null })}><option value="">Not set</option><option value="sheltered">Sheltered</option><option value="partial">Partly sheltered</option><option value="exposed">Exposed</option></Select></div>
              </div>
            )}
          </Group>
          <Group title="Depth" hint="Charted depth here feeds the clearance under the keel.">
            <div>
              <Label className="flex items-center gap-2">Charted depth (m) <DepthSourceChip source={wp.charted_depth_source} /></Label>
              <Input type="number" step="0.1" value={wp.charted_depth_m ?? ''} placeholder="From the chart" onChange={(e) => { const d = numOrNull(e.target.value); onChange({ charted_depth_m: d, charted_depth_source: d === null ? null : 'user' }); }} />
            </div>
            {needsDepth && <DepthPrompt lat={wp.lat} lon={wp.lon} onAccept={(s) => onChange({ charted_depth_m: s.depthM, charted_depth_source: 'gebco' })} />}
          </Group>
          {wp.sequence > 1 && (
            <Group title="Tidal stream on the leg to here" hint="Type the rate and set from the stream atlas for the hour you expect to be on this leg. It corrects the speed over ground and the ETA, and beats the model current on this leg. Leave empty to use the model surface current.">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Rate (kn)</Label><Input type="number" step="0.1" min="0" value={wp.stream_rate_kn ?? ''} placeholder="From the atlas" onChange={(e) => onChange({ stream_rate_kn: numOrNull(e.target.value) })} /></div>
                <div><Label>Sets toward (degrees true)</Label><Input type="number" step="1" min="0" max="359" value={wp.stream_set_deg ?? ''} placeholder="Direction it flows to" onChange={(e) => onChange({ stream_set_deg: numOrNull(e.target.value) })} /></div>
              </div>
              {wp.stream_rate_kn !== null && wp.stream_rate_kn !== undefined && (wp.stream_set_deg === null || wp.stream_set_deg === undefined) && <p className="t-caption flex items-center gap-1.5 text-risk-amber"><Waves className="h-3.5 w-3.5" /> Add the set direction, or the stream is ignored.</p>}
              {wp.stream_rate_kn !== null && wp.stream_rate_kn !== undefined && wp.stream_set_deg !== null && wp.stream_set_deg !== undefined && <p className="t-caption">{streamPhrase(wp.stream_rate_kn, wp.stream_set_deg, 'manual', wp.streamDeltaMin ?? null)}</p>}
            </Group>
          )}
          <Group title="Notes">
            <ToggleRow icon={<Mountain className="h-4 w-4" />} title="Complex coastline" hint="Caps confidence at moderate here, because models handle headlands and channels poorly." checked={wp.is_complex_coastal} onChange={(v) => onChange({ is_complex_coastal: v })} />
          </Group>
        </div>
        <div className="mt-6 flex justify-end"><Button onClick={onClose}>Done</Button></div>
      </DialogContent>
    </Dialog>
  );
}
