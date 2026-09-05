// The Windy popup. Raw model values for the scrubber's time step, labelled with model + run + lead
// time and lat/lon. Numbers only. No tide here: Open-Meteo sea level is not tide (product rule).
import { CircleDashed, Pin, X } from 'lucide-react';
import type { BrowseVar, PointForecast, RunInfo } from '@/lib/weather-browse/types.ts';
import { MODEL_LABEL } from '@/lib/weather-browse/types.ts';
import { windColor } from '@/lib/risk-colors.ts';
import { compassPoint } from '@/lib/units.ts';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { cn } from '@/lib/utils.ts';

export type CardValues = Partial<Record<BrowseVar, number | null>>;

type Props = {
  lat: number; lon: number; pinned: boolean; x: number; y: number; mobile: boolean;
  timeIso: string | null; run: RunInfo | null; leadHours: number | null;
  point: PointForecast | null; pointLoading: boolean; gridValues: CardValues | null; marineReason?: string | null;
  onClose: () => void; onPin: () => void;
};

const fmt = (v: number | null | undefined, dp: number) => (v === null || v === undefined || !Number.isFinite(v) ? null : v.toFixed(dp));

function Field({ label, value, unit, reason, arrow, colour, compass = true }: { label: string; value: string | null; unit?: string; reason?: string; arrow?: number | null; colour?: string; compass?: boolean }) {
  const empty = value === null;
  return (
    <div className={cn('rounded-md border px-2 py-1.5 min-h-[46px] flex flex-col justify-center min-w-0', empty ? 'gap-hatch border-dashed border-border/80' : 'border-border bg-bg-2')} title={empty ? reason : undefined}>
      <div className="label truncate">{label}</div>
      {empty ? (
        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-text-3"><CircleDashed className="h-3 w-3 shrink-0" /> no data</div>
      ) : (
        <div className="num text-[13px] font-medium leading-tight mt-0.5 flex items-center gap-1.5 whitespace-nowrap">
          {colour && <span className="inline-block h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: colour }} aria-hidden />}
          <span>{value}{unit ? <span className="font-sans text-[10px] text-text-3 ml-1 font-normal">{unit}</span> : null}</span>
          {arrow !== null && arrow !== undefined && Number.isFinite(arrow) && (
            <span className="inline-flex items-center gap-1 text-text-2" title={`from ${Math.round(arrow)}° (${compassPoint(arrow)})`}>
              <svg width="11" height="11" viewBox="0 0 14 14" style={{ transform: `rotate(${arrow + 180}deg)` }} aria-hidden><path d="M7 1 L10.5 8.5 L7 6.8 L3.5 8.5 Z" fill="currentColor" /><path d="M7 6.5 V13" stroke="currentColor" strokeWidth="1.5" /></svg>
              {compass && <span className="text-[10px] font-sans">{compassPoint(arrow)}</span>}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** 48 h wind sparkline from the hourly series, starting at the card's time step. */
function Sparkline({ point, timeIso }: { point: PointForecast; timeIso: string | null }) {
  const s = point.hourly.vars.wind_speed_10m ?? [];
  const g = point.hourly.vars.wind_gusts_10m ?? [];
  const start = Math.max(0, timeIso ? point.hourly.times.indexOf(timeIso) : 0);
  const from = Math.min(start, Math.max(0, s.length - 48));
  const seg = s.slice(from, from + 48), gseg = g.slice(from, from + 48);
  const vals = seg.filter((v): v is number => v !== null);
  if (vals.length < 2) return null;
  const max = Math.max(20, ...vals, ...gseg.filter((v): v is number => v !== null));
  const W = 260, H = 36;
  const px = (i: number) => (i / Math.max(1, seg.length - 1)) * W;
  const py = (v: number) => H - 2 - (v / max) * (H - 4);
  const path = (arr: (number | null)[]) => arr.map((v, i) => (v === null ? null : `${i === 0 || arr[i - 1] === null ? 'M' : 'L'}${px(i).toFixed(1)} ${py(v).toFixed(1)}`)).filter(Boolean).join(' ');
  const cur = start - from;
  return (
    <div>
      <div className="flex items-baseline justify-between"><span className="label">Wind, next 48 h</span><span className="num text-[10px] text-text-3">0–{Math.round(max)} kn</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-0.5 w-full h-9" preserveAspectRatio="none" aria-label="48 hour wind sparkline">
        {[10, 20, 30].filter((k) => k < max).map((k) => <line key={k} x1={0} x2={W} y1={py(k)} y2={py(k)} stroke="#23304A" strokeWidth={0.75} />)}
        <path d={path(gseg)} fill="none" stroke="#66748F" strokeWidth={1} strokeDasharray="2 2" />
        <path d={path(seg)} fill="none" stroke="#2DD4BF" strokeWidth={1.25} />
        {cur >= 0 && cur < seg.length && seg[cur] !== null && <circle cx={px(cur)} cy={py(seg[cur] as number)} r={2.2} fill="#E6EDF7" />}
      </svg>
    </div>
  );
}

export function PointCard({ lat, lon, pinned, x, y, mobile, timeIso, run, leadHours, point, pointLoading, gridValues, onClose, onPin }: Props) {
  // Prefer the hourly point series at the scrubber's step; fall back to the interpolated grid.
  let v: CardValues | null = gridValues;
  let sourceLabel = 'grid · 3-hourly';
  if (point && timeIso) {
    const i = point.hourly.times.indexOf(timeIso);
    if (i >= 0) {
      const at = (k: BrowseVar) => { const a = point.hourly.vars[k]; return a ? a[i] ?? null : null; };
      v = { wind_speed_10m: at('wind_speed_10m'), wind_direction_10m: at('wind_direction_10m'), wind_gusts_10m: at('wind_gusts_10m'), pressure_msl: at('pressure_msl'), precipitation: at('precipitation'), temperature_2m: at('temperature_2m'), wave_height: at('wave_height'), wave_direction: at('wave_direction'), wave_period: at('wave_period'), swell_wave_height: at('swell_wave_height'), swell_wave_direction: at('swell_wave_direction'), swell_wave_period: at('swell_wave_period') };
      sourceLabel = 'hourly';
    }
  }
  const marineReason = point?.marineReason ?? 'no marine value at this grid cell';
  const wind = v?.wind_speed_10m ?? null;
  const style: React.CSSProperties = mobile ? {} : { left: x + 18, top: y + 18 };
  const flipX = !mobile && typeof window !== 'undefined' && x + 18 + 320 > window.innerWidth;
  const flipY = !mobile && typeof window !== 'undefined' && y + 18 + 420 > window.innerHeight;
  if (flipX) { style.left = undefined; style.right = window.innerWidth - x + 18; }
  if (flipY) { style.top = undefined; style.bottom = window.innerHeight - y + 18; }
  return (
    <div role="dialog" aria-label={`Weather at ${lat.toFixed(2)}, ${lon.toFixed(2)}`}
      className={cn('z-[1150] rounded-lg border border-border bg-bg-1/[0.97] backdrop-blur-md shadow-[0_12px_40px_rgba(0,0,0,0.55)] text-sm', mobile ? 'fixed left-2 right-2 bottom-[92px] max-h-[62vh] overflow-y-auto' : 'fixed w-[316px] pointer-events-auto')}
      style={style} onMouseDown={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-2 border-b border-border">
        <div className="min-w-0 flex-1">
          <div className="num text-[12px] text-text-1">{Math.abs(lat).toFixed(3)}°{lat >= 0 ? 'N' : 'S'} {Math.abs(lon).toFixed(3)}°{lon >= 0 ? 'E' : 'W'}</div>
          <div className="text-[10.5px] text-text-3 truncate">{run ? MODEL_LABEL[run.model] : 'model'} · <span className="num">{run?.runLabel ?? '≈ run —'}</span>{leadHours !== null && <> · <span className="num">{leadHours >= 0 ? '+' : '−'}{Math.abs(leadHours)} h</span></>} · {sourceLabel}</div>
        </div>
        {!pinned && !mobile && <button type="button" onClick={onPin} className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-text-3 hover:text-text-1 hover:bg-bg-2" aria-label="Pin this point"><Pin className="h-3.5 w-3.5" /></button>}
        {(pinned || mobile) && <button type="button" onClick={onClose} className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-text-3 hover:text-text-1 hover:bg-bg-2" aria-label="Close"><X className="h-3.5 w-3.5" /></button>}
      </div>
      <div className="p-2.5 space-y-2">
        {!v && pointLoading ? (
          <div className="grid grid-cols-2 gap-1.5">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[46px]" />)}</div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            <Field label="Wind" value={fmt(wind, 0)} unit="kn" arrow={v?.wind_direction_10m ?? null} colour={wind === null ? undefined : windColor(wind)} reason="no atmospheric value here" />
            <Field label="Gust" value={fmt(v?.wind_gusts_10m, 0)} unit="kn" reason="no gust value here" />
            <Field label="Wave · period" value={v?.wave_height === null || v?.wave_height === undefined ? null : `${fmt(v.wave_height, 1)} m · ${fmt(v.wave_period, 0) ?? '—'} s`} arrow={v?.wave_direction ?? null} compass={false} reason={marineReason} />
            <Field label="Swell · period" value={v?.swell_wave_height === null || v?.swell_wave_height === undefined ? null : `${fmt(v.swell_wave_height, 1)} m · ${fmt(v.swell_wave_period, 0) ?? '—'} s`} arrow={v?.swell_wave_direction ?? null} compass={false} reason={marineReason} />
            <Field label="Pressure" value={fmt(v?.pressure_msl, 1)} unit="hPa" reason="no pressure value here" />
            <Field label="Temp · precip" value={v?.temperature_2m === null || v?.temperature_2m === undefined ? null : `${fmt(v.temperature_2m, 1)} °C · ${fmt(v.precipitation, 1) ?? '—'} mm`} reason="no value here" />
          </div>
        )}
        {point ? <Sparkline point={point} timeIso={timeIso} /> : pointLoading ? <Skeleton className="h-9" /> : null}
        <div className="text-[10.5px] text-text-3 border-t border-border pt-1.5 flex items-center justify-between gap-2">
          <span>Tide: from a station once you drop a pin here</span>
          {pointLoading && point === null && <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse" aria-label="loading" />}
        </div>
      </div>
    </div>
  );
}
