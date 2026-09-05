import type { RoseBin } from '../../../supabase/functions/_shared/departure-windows.ts';
import { windColor } from '@/lib/risk-colors.ts';

/** 16-sector rose, bar length = share of hours, colour = mean speed on the dark wind ramp. Direction is "from". */
export function WindRose({ bins, size = 220 }: { bins: RoseBin[]; size?: number }) {
  const total = bins.reduce((s, b) => s + b.hours, 0);
  const cx = size / 2, cy = size / 2, R = size / 2 - 18;
  if (total === 0) return <div className="gap-hatch rounded-md border border-border text-xs text-text-3 flex items-center justify-center" style={{ width: size, height: size }}>no wind data in the window</div>;
  const maxShare = Math.max(...bins.map((b) => b.hours / total));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="num">
      {[0.25, 0.5, 0.75, 1].map((f) => <circle key={f} cx={cx} cy={cy} r={R * f} fill="none" stroke="#23304A" strokeDasharray="2 3" />)}
      {bins.map((b) => {
        const share = b.hours / total / (maxShare || 1);
        const r = R * share;
        const a0 = ((b.sector * 22.5 - 11.25 - 90) * Math.PI) / 180, a1 = ((b.sector * 22.5 + 11.25 - 90) * Math.PI) / 180;
        const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
        return <path key={b.sector} d={`M${cx},${cy} L${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1} Z`} fill={windColor(b.mean_speed_kn)} fillOpacity={0.75} stroke="#0B1220" strokeWidth={0.5}><title>{b.label}: {b.hours} h, mean {b.mean_speed_kn ?? '—'} kn, max {b.max_speed_kn ?? '—'} kn</title></path>;
      })}
      {['N', 'E', 'S', 'W'].map((l, i) => { const a = ((i * 90 - 90) * Math.PI) / 180; return <text key={l} x={cx + (R + 10) * Math.cos(a)} y={cy + (R + 10) * Math.sin(a) + 4} textAnchor="middle" fontSize="10" fill="#9AA8C0">{l}</text>; })}
    </svg>
  );
}
