// "Map options" popover at the top left, under the zoom control: model, particles, OpenSeaMap overlay.
import { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { MODEL_LABEL, type BrowseModel, type RunInfo } from '@/lib/weather-browse/types.ts';
import { Segmented } from '@/components/ui/segmented.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { cn } from '@/lib/utils.ts';

type Props = {
  model: BrowseModel; setModel: (m: BrowseModel) => void; run: RunInfo | null;
  particles: boolean; setParticles: (v: boolean) => void;
  openSeaMap: boolean; setOpenSeaMap: (v: boolean) => void;
  className?: string;
};

export function MapOptions({ model, setModel, run, particles, setParticles, openSeaMap, setOpenSeaMap, className }: Props) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown); document.addEventListener('touchstart', onDown); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div ref={wrap} className={cn('relative', className)}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="dialog" className={cn('inline-flex h-9 items-center gap-2 rounded-lg border border-border-soft bg-bg-1/95 backdrop-blur-sm px-3 text-[13px] font-medium shadow-card transition-colors', open ? 'text-text-1' : 'text-text-2 hover:text-text-1')}>
        <SlidersHorizontal className="h-4 w-4" /> Map options
      </button>
      {open && (
        <div role="dialog" aria-label="Map options" className="absolute left-0 top-full mt-1.5 w-[280px] rounded-xl border border-border-soft bg-bg-1/95 backdrop-blur-sm p-4 shadow-pop space-y-4 animate-in fade-in-0 zoom-in-95 duration-150">
          <div>
            <div className="label mb-1.5">Forecast model</div>
            <Segmented<BrowseModel> label="Forecast model" value={model} onChange={setModel} size="sm" fullWidth options={[{ value: 'ecmwf_ifs025', label: 'ECMWF', title: MODEL_LABEL.ecmwf_ifs025 }, { value: 'gfs_seamless', label: 'GFS', title: MODEL_LABEL.gfs_seamless }]} />
            <div className="t-caption mt-1.5">{run ? `${MODEL_LABEL[run.model]}, ${run.runLabel.replace('≈ ', 'about ')}` : MODEL_LABEL[model]}. Free browse models, not the passage ensemble.</div>
          </div>
          <label className="flex items-center justify-between gap-3 cursor-pointer"><span className="text-[13px]">Animated wind particles</span><Switch checked={particles} onCheckedChange={setParticles} aria-label="Animated wind particles" /></label>
          <label className="flex items-center justify-between gap-3 cursor-pointer"><span className="text-[13px]">OpenSeaMap seamarks <span className="block t-caption">Crowdsourced, not official</span></span><Switch checked={openSeaMap} onCheckedChange={setOpenSeaMap} aria-label="OpenSeaMap overlay" /></label>
        </div>
      )}
    </div>
  );
}
