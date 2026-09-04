// Band chart: time on x, p10..p90 band (accent at 20 %), p50 solid, comparison dashed, vessel limit red. PRD §9.4.
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { BandPoint } from '@/hooks/useBandSeries.ts';
import { ACCENT, FLAG_VIOLET, RISK_HEX } from '@/lib/risk-colors.ts';

export function BandChart({ points, limitKn, etaIso, comparisonLabel }: { points: BandPoint[]; limitKn: number | null; etaIso?: string | null; comparisonLabel: string }) {
  if (points.length === 0) return <div className="h-48 gap-hatch rounded-md border border-border flex items-center justify-center text-xs text-text-3">no forecast series for this target yet</div>;
  const data = points.map((p) => ({ ...p, band: p.p10 !== null && p.p90 !== null ? [p.p10, p.p90] : null }));
  const fmtT = (t: number) => { const d = new Date(t); return `${d.getUTCDate()}/${d.getUTCMonth() + 1} ${String(d.getUTCHours()).padStart(2, '0')}Z`; };
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#23304A" strokeDasharray="2 4" />
          <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={fmtT} stroke="#66748F" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
          <YAxis stroke="#66748F" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} unit=" kn" />
          <Tooltip contentStyle={{ background: '#182338', border: '1px solid #23304A', fontSize: 11 }} labelFormatter={(t) => fmtT(Number(t))} formatter={(v: unknown, name) => [Array.isArray(v) ? `${v[0]}–${v[1]} kn` : `${v} kn`, name]} />
          <Area dataKey="band" name="p10–p90" stroke="none" fill={ACCENT} fillOpacity={0.2} isAnimationActive={false} connectNulls />
          <Line dataKey="p50" name="p50 (primary)" stroke={ACCENT} dot={false} strokeWidth={1.5} isAnimationActive={false} connectNulls />
          <Line dataKey="cmp" name={comparisonLabel} stroke={FLAG_VIOLET} strokeDasharray="4 3" dot={false} strokeWidth={1.2} isAnimationActive={false} connectNulls />
          {limitKn !== null && <ReferenceLine y={limitKn} stroke={RISK_HEX.red} strokeWidth={1} label={{ value: `limit ${limitKn} kn`, fill: RISK_HEX.red, fontSize: 10, position: 'insideTopRight' }} />}
          {etaIso && <ReferenceLine x={Date.parse(etaIso)} stroke="#E6EDF7" strokeDasharray="2 2" label={{ value: 'ETA', fill: '#E6EDF7', fontSize: 10, position: 'top' }} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
