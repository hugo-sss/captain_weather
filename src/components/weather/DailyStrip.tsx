// 7-day strip for the map centre or the pinned point: day, hi/lo temp, max wind kn, rain mm. Icon-free.
// Collapsed header at the top of the right rail; opening it never covers the map on desktop.
import { ChevronDown } from 'lucide-react';
import type { PointForecast } from '@/lib/weather-browse/types.ts';
import { MODEL_LABEL } from '@/lib/weather-browse/types.ts';
import { windColor } from '@/lib/risk-colors.ts';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { cn } from '@/lib/utils.ts';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function DailyStrip({ daily, target, pinned, open, onToggle }: { daily: PointForecast | null; target: { lat: number; lon: number } | null; pinned: boolean; open: boolean; onToggle: () => void }) {
  const stale = !!daily && !!target && (Math.abs(daily.lat - target.lat) > 0.06 || Math.abs(daily.lon - target.lon) > 0.06);
  const d = daily && !stale ? daily : null;
  return (
    <section className="border-b border-border">
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-bg-2/50">
        <span className="label flex-1">7 days · {pinned ? 'pinned point' : 'map centre'}</span>
        {target && <span className="num text-[10.5px] text-text-3">{target.lat.toFixed(2)}, {target.lon.toFixed(2)}</span>}
        <ChevronDown className={cn('h-3.5 w-3.5 text-text-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-2 pb-2">
          {d ? (
            <>
              <div className="grid grid-cols-7 gap-1">
                {d.daily.slice(0, 7).map((day) => {
                  const dt = new Date(day.date + 'T00:00:00Z');
                  return (
                    <div key={day.date} className="tile px-1 py-1.5 text-center min-w-0">
                      <div className="text-[9.5px] uppercase tracking-[0.04em] text-text-3 whitespace-nowrap">{DAYS[dt.getUTCDay()]} <span className="num">{dt.getUTCDate()}</span></div>
                      <div className="num text-[11px] mt-1 leading-tight"><span className="text-text-1">{day.tMaxC === null ? '—' : Math.round(day.tMaxC)}</span><span className="text-text-3">/{day.tMinC === null ? '—' : Math.round(day.tMinC)}°</span></div>
                      <div className="num text-[12px] font-medium mt-1 leading-tight" style={{ color: day.windMaxKn === null ? undefined : windColor(day.windMaxKn) }}>{day.windMaxKn === null ? '—' : Math.round(day.windMaxKn)}<span className="font-sans text-[9px] text-text-3 ml-0.5">kn</span></div>
                      <div className="num text-[10px] text-text-2 mt-0.5 leading-tight">{day.precipMm === null ? '—' : day.precipMm < 0.05 ? '0' : day.precipMm.toFixed(day.precipMm < 10 ? 1 : 0)}<span className="font-sans text-[9px] text-text-3 ml-0.5">mm</span></div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-1.5 text-[10px] text-text-3 flex justify-between"><span>hi/lo °C · max wind · rain</span><span>{MODEL_LABEL[d.run.model]} · <span className="num">{d.run.runLabel}</span></span></div>
            </>
          ) : (
            <div className="grid grid-cols-7 gap-1">{Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-[74px]" />)}</div>
          )}
        </div>
      )}
    </section>
  );
}
