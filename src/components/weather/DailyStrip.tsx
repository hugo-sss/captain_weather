// 7-day strip for the map centre or the pinned point: day, high and low temperature, max wind, rain.
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
    <section className="card">
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full flex items-center gap-2 px-4 py-3 text-left rounded-xl hover:bg-bg-elev">
        <span className="t-card flex-1">Next 7 days <span className="t-caption font-normal">at the {pinned ? 'pinned point' : 'map centre'}</span></span>
        {target && <span className="num text-[11px] text-text-3">{target.lat.toFixed(2)}, {target.lon.toFixed(2)}</span>}
        <ChevronDown className={cn('h-4 w-4 text-text-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-4 pb-4">
          {d ? (
            <>
              <div className="grid grid-cols-7 gap-1">
                {d.daily.slice(0, 7).map((day) => {
                  const dt = new Date(day.date + 'T00:00:00Z');
                  return (
                    <div key={day.date} className="tile px-1 py-2 text-center min-w-0">
                      <div className="text-[11px] text-text-3 whitespace-nowrap">{DAYS[dt.getUTCDay()]} <span className="num">{dt.getUTCDate()}</span></div>
                      <div className="num text-[12px] mt-1 leading-tight"><span className="text-text-1">{day.tMaxC === null ? 'n/a' : Math.round(day.tMaxC)}</span><span className="text-text-3">/{day.tMinC === null ? 'n/a' : Math.round(day.tMinC)}°</span></div>
                      <div className="num text-[13px] font-semibold mt-1 leading-tight" style={{ color: day.windMaxKn === null ? undefined : windColor(day.windMaxKn) }}>{day.windMaxKn === null ? 'n/a' : Math.round(day.windMaxKn)}<span className="font-sans text-[9px] text-text-3 ml-0.5 font-normal">kn</span></div>
                      <div className="num text-[11px] text-text-2 mt-0.5 leading-tight">{day.precipMm === null ? 'n/a' : day.precipMm < 0.05 ? '0' : day.precipMm.toFixed(day.precipMm < 10 ? 1 : 0)}<span className="font-sans text-[9px] text-text-3 ml-0.5">mm</span></div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 text-[11px] text-text-3 flex justify-between"><span>High and low °C, max wind, rain</span><span>{MODEL_LABEL[d.run.model]}, {d.run.runLabel.replace('≈ ', 'about ')}</span></div>
            </>
          ) : (
            <div className="grid grid-cols-7 gap-1">{Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-[78px]" />)}</div>
          )}
        </div>
      )}
    </section>
  );
}
