import { useState } from 'react';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Select } from '@/components/ui/select.tsx';
import { Button } from '@/components/ui/button.tsx';
import type { VesselDraft } from './vesselDraft.ts';

type Props = { initial: VesselDraft; onChange: (d: VesselDraft) => void; onSave: () => Promise<void>; saving: boolean; error: string | null };
type Change = React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;

function NumField({ k, label, step = '0.1', value, onChange }: { k: keyof VesselDraft; label: string; step?: string; value: string; onChange: (e: Change) => void }) {
  return <div><Label htmlFor={k}>{label}</Label><Input id={k} type="number" step={step} value={value} onChange={onChange} /></div>;
}

export function VesselForm({ initial, onChange, onSave, saving, error }: Props) {
  const [d, setD] = useState(initial);
  const set = (k: keyof VesselDraft) => (e: Change) => { const nd = { ...d, [k]: e.target.value }; setD(nd); onChange(nd); };
  const f = (k: keyof VesselDraft, label: string, step?: string) => <NumField key={k} k={k} label={label} step={step} value={d[k]} onChange={set(k)} />;
  return (
    <form onSubmit={(e) => { e.preventDefault(); void onSave(); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Label htmlFor="name">Name</Label><Input id="name" required value={d.name} onChange={set('name')} /></div>
        <div><Label htmlFor="vessel_class">Class</Label><Select id="vessel_class" value={d.vessel_class} onChange={set('vessel_class')}><option value="motor">motor</option><option value="sail">sail</option><option value="catamaran">catamaran</option><option value="tender">tender</option></Select></div>
        {f('cruise_speed_kn', 'Cruise speed (kn)')}
        {f('length_m', 'Length (m)')}{f('beam_m', 'Beam (m)')}
        {f('draft_m', 'Draft (m) — needed for UKC', '0.05')}{f('air_draft_m', 'Air draft (m)')}
        {f('max_speed_kn', 'Max speed (kn)')}
      </div>
      <div>
        <div className="label mb-2">Thresholds (drive the risk flag; a blank limit skips that rule, it never guesses)</div>
        <div className="grid grid-cols-2 gap-3">
          {f('max_wind_kn', 'Max sustained wind p50 (kn)')}{f('max_gust_kn', 'Max gust p90 (kn)')}
          {f('max_wave_m', 'Max significant wave (m)')}{f('max_current_kn', 'Max current (kn)')}
          {f('min_ukc_m', 'Minimum UKC (m)', '0.05')}
        </div>
      </div>
      <div><Label htmlFor="notes">Notes</Label><textarea id="notes" className="w-full rounded-md border border-border bg-bg-0 p-2 text-sm" rows={2} value={d.notes} onChange={set('notes')} /></div>
      {error && <p className="text-xs text-risk-red">{error}</p>}
      <Button type="submit" disabled={saving || !d.name || !d.cruise_speed_kn}>{saving ? 'Saving…' : 'Save vessel'}</Button>
    </form>
  );
}
