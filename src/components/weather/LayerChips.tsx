// Layer chips (Windy-style): one scalar field at a time, particles optional on top, live radar stackable.
// Plus the model chip. Sits top-left under the zoom control on desktop; a scrolling row on mobile.
import { CloudRain, Gauge, RadarIcon, Waves, Wind, type LucideIcon } from 'lucide-react';
import type { FieldKind } from '@/lib/weather-browse/ramps.ts';
import { MODEL_LABEL, MODEL_SHORT, type BrowseModel, type RunInfo } from '@/lib/weather-browse/types.ts';
import { cn } from '@/lib/utils.ts';

const FIELDS: { kind: FieldKind; label: string; icon: LucideIcon; hint: string }[] = [
  { kind: 'wind', label: 'Wind', icon: Wind, hint: '10 m wind, kn' },
  { kind: 'gusts', label: 'Gusts', icon: Wind, hint: '10 m gusts, kn' },
  { kind: 'waves', label: 'Waves', icon: Waves, hint: 'significant wave height, m' },
  { kind: 'swell', label: 'Swell', icon: Waves, hint: 'swell height, m' },
  { kind: 'rain', label: 'Rain', icon: CloudRain, hint: 'forecast precipitation, mm per 3 h' },
  { kind: 'pressure', label: 'Pressure', icon: Gauge, hint: 'mean sea-level pressure, hPa' },
];

type Props = {
  field: FieldKind; setField: (k: FieldKind) => void;
  particles: boolean; setParticles: (v: boolean) => void;
  radarOn: boolean; setRadarOn: (v: boolean) => void;
  model: BrowseModel; setModel: (m: BrowseModel) => void;
  run: RunInfo | null; leadHours: number | null; loading: boolean; error: string | null;
  layout: 'column' | 'row';
};

const chip = (active: boolean) => cn('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium transition-colors backdrop-blur-sm whitespace-nowrap', active ? 'border-accent/50 bg-accent/15 text-accent' : 'border-border bg-bg-1/95 text-text-2 hover:text-text-1 hover:border-text-3/60');

export function LayerChips({ field, setField, particles, setParticles, radarOn, setRadarOn, model, setModel, run, leadHours, loading, error, layout }: Props) {
  const row = layout === 'row';
  return (
    <div className={cn('flex gap-1.5', row ? 'flex-row items-center overflow-x-auto pr-2 [scrollbar-width:none]' : 'flex-col items-start')} role="toolbar" aria-label="Weather layers">
      {FIELDS.map((f) => (
        <button key={f.kind} type="button" className={chip(field === f.kind)} aria-pressed={field === f.kind} title={f.hint}
          onClick={() => { setField(f.kind); if (f.kind === 'wind' || f.kind === 'gusts') setParticles(true); }}>
          <f.icon className="h-3.5 w-3.5" /> {f.label}
        </button>
      ))}
      <button type="button" className={chip(radarOn)} aria-pressed={radarOn} title="Observed rain radar (RainViewer), stacks on any field" onClick={() => setRadarOn(!radarOn)}>
        <RadarIcon className="h-3.5 w-3.5" /> Radar <span className={cn('ml-0.5 rounded-sm px-1 text-[9px] uppercase tracking-[0.08em]', radarOn ? 'bg-accent/20' : 'bg-bg-2 text-text-3')}>live</span>
      </button>
      <button type="button" className={chip(particles)} aria-pressed={particles} title="Animated wind particles" onClick={() => setParticles(!particles)}>
        <span aria-hidden className="inline-block h-px w-3.5 bg-current" /> Particles
      </button>
      <div className={cn('inline-flex h-8 shrink-0 items-center rounded-md border border-border bg-bg-1/95 backdrop-blur-sm p-0.5', !row && 'mt-1')} role="radiogroup" aria-label="Model">
        {(['ecmwf_ifs025', 'gfs_seamless'] as BrowseModel[]).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={model === m} title={MODEL_LABEL[m]} onClick={() => setModel(m)}
            className={cn('h-7 rounded-[5px] px-2.5 text-[12px] font-medium transition-colors', model === m ? 'bg-bg-2 text-text-1 shadow-[inset_0_-2px_0_#2DD4BF]' : 'text-text-3 hover:text-text-1')}>{MODEL_SHORT[m]}</button>
        ))}
      </div>
      <div className={cn('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-bg-1/95 backdrop-blur-sm px-2.5 text-[11px] text-text-2 whitespace-nowrap', error && 'border-risk-amber/50 text-risk-amber')} aria-live="polite">
        {error ? <span title={error}>data unavailable</span> : (
          <>
            <span className="text-text-1">{MODEL_LABEL[model]}</span>
            <span className="text-text-3">·</span>
            <span className="num">{run?.runLabel ?? '≈ run —'}</span>
            {leadHours !== null && <><span className="text-text-3">·</span><span className="num">{leadHours >= 0 ? '+' : '−'}{Math.abs(leadHours)} h</span></>}
            {loading && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse" aria-label="loading" />}
          </>
        )}
      </div>
    </div>
  );
}
