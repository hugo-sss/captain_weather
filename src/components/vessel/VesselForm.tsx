import { useState } from 'react';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Select } from '@/components/ui/select.tsx';
import { Button } from '@/components/ui/button.tsx';
import type { VesselDraft } from './vesselDraft.ts';

type Props = { initial: VesselDraft; onChange: (d: VesselDraft) => void; onSave: () => Promise<void>; saving: boolean; error: string | null };
type Change = React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;

function NumField({ k, label, unit, hint, step = '0.1', value, onChange }: { k: keyof VesselDraft; label: string; unit: string; hint?: string; step?: string; value: string; onChange: (e: Change) => void }) {
  return (
    <div>
      <Label htmlFor={k}>{label} <span className="text-text-3/80 normal-case tracking-normal">({unit})</span></Label>
      <Input id={k} type="number" step={step} value={value} onChange={onChange} placeholder="—" />
      {hint && <div className="text-[11px] text-text-3 mt-1">{hint}</div>}
    </div>
  );
}

const Section = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <fieldset className="space-y-3">
    <legend className="label text-text-2 mb-2">{title}{hint && <span className="ml-2 normal-case tracking-normal text-text-3 font-normal">{hint}</span>}</legend>
    <div className="grid grid-cols-2 gap-3">{children}</div>
  </fieldset>
);

export function VesselForm({ initial, onChange, onSave, saving, error }: Props) {
  const [d, setD] = useState(initial);
  const set = (k: keyof VesselDraft) => (e: Change) => { const nd = { ...d, [k]: e.target.value }; setD(nd); onChange(nd); };
  const f = (k: keyof VesselDraft, label: string, unit: string, opts?: { step?: string; hint?: string }) => <NumField key={k} k={k} label={label} unit={unit} step={opts?.step} hint={opts?.hint} value={d[k]} onChange={set(k)} />;
  return (
    <form onSubmit={(e) => { e.preventDefault(); void onSave(); }} className="space-y-5">
      <Section title="Identity">
        <div className="col-span-2"><Label htmlFor="name">Name</Label><Input id="name" required value={d.name} onChange={set('name')} placeholder="M/Y …" /></div>
        <div><Label htmlFor="vessel_class">Class</Label><Select id="vessel_class" value={d.vessel_class} onChange={set('vessel_class')}><option value="motor">motor</option><option value="sail">sail</option><option value="catamaran">catamaran</option><option value="tender">tender</option></Select></div>
        {f('cruise_speed_kn', 'Cruise speed', 'kn', { hint: 'Drives every ETA.' })}
        {f('max_speed_kn', 'Max speed', 'kn')}
      </Section>
      <Section title="Dimensions">
        {f('length_m', 'Length', 'm')}{f('beam_m', 'Beam', 'm')}
        {f('draft_m', 'Draft', 'm', { step: '0.05', hint: 'Needed for under-keel clearance.' })}{f('air_draft_m', 'Air draft', 'm')}
      </Section>
      <Section title="Thresholds" hint="drive the risk flag; a blank limit skips that rule, it never guesses">
        {f('max_wind_kn', 'Max sustained wind p50', 'kn')}{f('max_gust_kn', 'Max gust p90', 'kn')}
        {f('max_wave_m', 'Max significant wave', 'm')}{f('max_current_kn', 'Max current', 'kn')}
        {f('min_ukc_m', 'Minimum UKC', 'm', { step: '0.05' })}
      </Section>
      <div><Label htmlFor="notes">Notes</Label><textarea id="notes" className="w-full rounded-md border border-border bg-bg-0 p-2.5 text-sm transition-colors hover:border-text-3/60 focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30" rows={2} value={d.notes} onChange={set('notes')} /></div>
      {error && <p className="text-xs text-risk-red">{error}</p>}
      <div className="flex items-center gap-3 border-t border-border pt-4">
        <Button type="submit" disabled={saving || !d.name || !d.cruise_speed_kn}>{saving ? 'Saving…' : 'Save vessel'}</Button>
        {(!d.name || !d.cruise_speed_kn) && <span className="text-[11px] text-text-3">Name and cruise speed are required.</span>}
      </div>
    </form>
  );
}
