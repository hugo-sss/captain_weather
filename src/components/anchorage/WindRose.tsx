import type { RoseBin } from '../../../supabase/functions/_shared/departure-windows.ts';
import { WIND_RAMP, windColor } from '@/lib/risk-colors.ts';

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** 16-sector rose, bar length = share of hours, colour = mean speed on the dark wind ramp. Direction is "from". */
export function WindRose({ bins, size = 220 }: { bins: RoseBin[]; size?: number }) {
  const total = bins.reduce((s, b) => s + b.hours, 0);
  const cx = size / 2, cy = size / 2, R = size / 2 - 22;
  if (total === 0) return <div className="gap-hatch rounded-md border border-dashed border-border text-xs text-text-3 flex items-center justify-center mx-auto" style={{ width: size, height: size }}>no wind data in the window</div>;
  const maxShare = Math.max(...bins.map((b) => b.hours / total));
  const ramp = `linear-gradient(90deg, ${WIND_RAMP.map(([k, c]) => `${c} ${(k / 50) * 100}%`).join(', ')})`;
  return (
    <div className="space-y-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="num mx-auto block" role="img" aria-label="Wind rose: share of forecast hours by direction the wind blows from">
        {[0.25, 0.5, 0.75, 1].map((f) => <circle key={f} cx={cx} cy={cy} r={R * f} fill="none" stroke="#23304A" strokeDasharray="2 3" />)}
        {[0.5, 1].map((f) => <text key={f} x={cx + 3} y={cy - R * f + 9} fontSize="8" fill="#66748F">{Math.round(maxShare * f * 100)}%</text>)}
        {[0, 45, 90, 135].map((a) => { const r = (a * Math.PI) / 180; return <line key={a} x1={cx - R * Math.sin(r)} y1={cy + R * Math.cos(r)} x2={cx + R * Math.sin(r)} y2={cy - R * Math.cos(r)} stroke="#23304A" strokeWidth={0.5} />; })}
        {bins.map((b) => {
          if (b.hours === 0) return null;
          const share = b.hours / total / (maxShare || 1);
          const r = R * share;
          const a0 = ((b.sector * 22.5 - 10 - 90) * Math.PI) / 180, a1 = ((b.sector * 22.5 + 10 - 90) * Math.PI) / 180;
          const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
          return <path key={b.sector} d={`M${cx},${cy} L${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1} Z`} fill={windColor(b.mean_speed_kn)} fillOpacity={0.85} stroke="#0B1220" strokeWidth={1}><title>{b.label}: {b.hours} h, mean {b.mean_speed_kn ?? '—'} kn, max {b.max_speed_kn ?? '—'} kn</title></path>;
        })}
        <circle cx={cx} cy={cy} r={2} fill="#E6EDF7" />
        {POINTS.map((l, i) => { const a = ((i * 45 - 90) * Math.PI) / 180; const major = i % 2 === 0; return <text key={l} x={cx + (R + 12) * Math.cos(a)} y={cy + (R + 12) * Math.sin(a) + 3.5} textAnchor="middle" fontSize={major ? 10 : 8} fontWeight={major ? 600 : 400} fill={major ? '#E6EDF7' : '#66748F'}>{l}</text>; })}
      </svg>
      <div className="mx-auto" style={{ width: size }}>
        <div className="h-1.5 rounded-full" style={{ background: ramp }} />
        <div className="num flex justify-between text-[9px] text-text-3 mt-0.5"><span>0</span><span>10</span><span>20</span><span>30</span><span>40</span><span>50+ kn</span></div>
      </div>
    </div>
  );
}
