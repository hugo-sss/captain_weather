// Live observed rain radar from RainViewer's keyless API: the frame list comes from the browse
// source, the tiles from `${host}${path}/256/{z}/{x}/{y}/2/1_1.png`. Own mini scrubber (last 2 h +
// nowcast) with play, and a "LIVE · hh:mm (n min ago)" chip. Attribution "Radar © RainViewer".
import { useEffect, useState } from 'react';
import { TileLayer } from 'react-leaflet';
import { Pause, Play } from 'lucide-react';
import { radarTileUrl } from '@/lib/weather-browse/openMeteo.ts';
import type { RadarFrame } from '@/lib/weather-browse/types.ts';
import { cn } from '@/lib/utils.ts';
import { useNow } from '@/hooks/useNow.ts';

export const RADAR_ATTRIBUTION = 'Radar &copy; <a href="https://www.rainviewer.com/">RainViewer</a>';

export function RadarTiles({ host, frame }: { host: string; frame: RadarFrame | null }) {
  if (!frame) return null;
  return <TileLayer url={radarTileUrl(host, frame.path)} opacity={0.75} attribution={RADAR_ATTRIBUTION} zIndex={430} maxNativeZoom={12} />;
}

type BarProps = { frames: (RadarFrame & { nowcast: boolean })[]; idx: number; onChange: (i: number) => void; error: string | null; utcOffsetMin: number | null; className?: string };

const localHm = (unixS: number, offsetMin: number) => { const d = new Date(unixS * 1000 + offsetMin * 60_000); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };

export function RadarBar({ frames, idx, onChange, error, utcOffsetMin, className }: BarProps) {
  const offset = utcOffsetMin ?? -new Date().getTimezoneOffset();
  const [playing, setPlaying] = useState(false);
  const n = frames.length;
  useEffect(() => {
    if (!playing || n === 0) return;
    const id = setInterval(() => onChange((idx + 1) % n), 450);
    return () => clearInterval(id);
  }, [playing, n, idx, onChange]);
  const now = useNow(30_000);
  const latestPast = [...frames].reverse().find((f) => !f.nowcast) ?? null;
  const ageMin = latestPast ? Math.max(0, Math.round((now / 1000 - latestPast.time) / 60)) : null;
  const cur = frames[idx] ?? null;
  return (
    <div className={cn('rounded-md border border-border bg-bg-1/95 backdrop-blur-sm px-2.5 py-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.35)] flex items-center gap-2', className)} aria-label="Rain radar frames">
      <span className={cn('inline-flex h-6 shrink-0 items-center gap-1.5 rounded-sm border px-1.5 text-[10.5px] uppercase tracking-[0.06em]', error ? 'border-risk-amber/50 text-risk-amber' : 'border-accent/40 bg-accent/10 text-accent')}>
        <span className={cn('inline-block h-1.5 w-1.5 rounded-full', error ? 'bg-risk-amber' : 'bg-accent animate-pulse')} aria-hidden />
        {error ? 'radar unavailable' : latestPast ? <>live · <span className="num normal-case tracking-normal">{localHm(latestPast.time, offset)}</span>{ageMin !== null && <span className="normal-case tracking-normal text-accent/80">({ageMin} min ago)</span>}</> : 'live · loading'}
      </span>
      <button type="button" onClick={() => setPlaying((p) => !p)} disabled={n === 0} aria-label={playing ? 'Pause radar' : 'Play radar'} className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-border bg-bg-2 text-text-1 hover:border-accent/60 disabled:opacity-50">
        {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 ml-px" />}
      </button>
      <div className="flex-1 min-w-[120px] flex items-center gap-px h-6" role="slider" aria-valuemin={0} aria-valuemax={Math.max(0, n - 1)} aria-valuenow={idx} aria-label="Radar frame" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'ArrowRight') onChange(Math.min(n - 1, idx + 1)); else if (e.key === 'ArrowLeft') onChange(Math.max(0, idx - 1)); }}>
        {frames.map((f, i) => (
          <button key={f.time} type="button" onClick={() => { setPlaying(false); onChange(i); }} title={`${localHm(f.time, offset)}${f.nowcast ? ' nowcast' : ''}`} aria-label={`${localHm(f.time, offset)}${f.nowcast ? ' nowcast' : ''}`}
            className={cn('flex-1 h-3 rounded-[2px] transition-colors', i === idx ? 'bg-accent' : f.nowcast ? 'bg-transparent border border-dashed border-text-3/70 hover:border-accent' : 'bg-border hover:bg-text-3')} />
        ))}
        {n === 0 && <span className="text-[11px] text-text-3">{error ?? 'loading frames'}</span>}
      </div>
      <span className="num shrink-0 text-[11px] text-text-2 min-w-[74px] text-right">{cur ? `${localHm(cur.time, offset)}${cur.nowcast ? ' fcst' : ''}` : ''}</span>
      <span className="hidden sm:inline shrink-0 text-[10px] text-text-3">Radar © RainViewer</span>
    </div>
  );
}
