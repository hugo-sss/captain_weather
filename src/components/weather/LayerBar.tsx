// Floating layer bar (bottom centre above the time bar): one scalar field at a time, radar stackable.
// Model and particles live in MapOptions. A scrolling row on phones.
import { CloudRain, Gauge, RadarIcon, Waves, Wind, type LucideIcon } from 'lucide-react';
import type { FieldKind } from '@/lib/weather-browse/ramps.ts';
import { cn } from '@/lib/utils.ts';

const FIELDS: { kind: FieldKind; label: string; icon: LucideIcon; hint: string }[] = [
  { kind: 'wind', label: 'Wind', icon: Wind, hint: 'Wind at 10 m, knots' },
  { kind: 'gusts', label: 'Gusts', icon: Wind, hint: 'Gusts at 10 m, knots' },
  { kind: 'waves', label: 'Waves', icon: Waves, hint: 'Significant wave height, metres' },
  { kind: 'swell', label: 'Swell', icon: Waves, hint: 'Swell height, metres' },
  { kind: 'rain', label: 'Rain', icon: CloudRain, hint: 'Forecast rain, mm per 3 h' },
  { kind: 'pressure', label: 'Pressure', icon: Gauge, hint: 'Sea-level pressure, hPa' },
];

type Props = { field: FieldKind; setField: (k: FieldKind) => void; setParticles: (v: boolean) => void; radarOn: boolean; setRadarOn: (v: boolean) => void; compact?: boolean; className?: string };

export function LayerBar({ field, setField, setParticles, radarOn, setRadarOn, compact, className }: Props) {
  const btn = (active: boolean) => cn('inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium transition-colors whitespace-nowrap', compact ? 'h-9 px-3 text-[13px]' : 'h-9 px-3.5 text-[13px]', active ? 'bg-accent text-bg-0' : 'text-text-2 hover:text-text-1 hover:bg-bg-2');
  return (
    <div role="toolbar" aria-label="Weather layers" className={cn('flex items-center gap-1 rounded-full border border-border-soft bg-bg-1/95 backdrop-blur-sm p-1 shadow-card', compact && 'overflow-x-auto [scrollbar-width:none] max-w-full', className)}>
      {FIELDS.map((f) => (
        <button key={f.kind} type="button" className={btn(field === f.kind)} aria-pressed={field === f.kind} title={f.hint}
          onClick={() => { setField(f.kind); if (f.kind === 'wind' || f.kind === 'gusts') setParticles(true); }}>
          <f.icon className="h-4 w-4" /> {f.label}
        </button>
      ))}
      <span className="mx-0.5 h-5 w-px bg-border-soft shrink-0" aria-hidden />
      <button type="button" className={btn(radarOn)} aria-pressed={radarOn} title="Observed rain radar (RainViewer), on top of any layer" onClick={() => setRadarOn(!radarOn)}>
        <RadarIcon className="h-4 w-4" /> Radar
      </button>
    </div>
  );
}
