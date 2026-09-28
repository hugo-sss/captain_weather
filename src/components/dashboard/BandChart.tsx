// Band chart: time on x, p10..p90 band (accent at 20 %), p50 solid, comparison dashed, vessel limit red. PRD §9.4.
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { BandPoint } from '@/hooks/useBandSeries.ts';
import { ACCENT, FLAG_VIOLET, RISK_HEX } from '@/lib/risk-colors.ts';
import { ChartFrame } from './ChartFrame.tsx';
import { CHART_AXIS, CHART_FONT, CHART_GRID, CHART_TICK, CHART_TOOLTIP, hourTicks, tickFormatterFor } from './chart-theme.ts';

export function BandChart({ points, limitKn, etaIso, comparisonLabel, utcOffsetMin = null, title, meta, bare }: { points: BandPoint[]; limitKn: number | null; etaIso?: string | null; comparisonLabel: string; utcOffsetMin?: number | null; title?: string; meta?: React.ReactNode; bare?: boolean }) {
  const fmtTick = tickFormatterFor(utcOffsetMin);
  const legend = [{ label: 'Likely range (p10 to p90)', swatch: 'rgba(45,212,191,0.35)' }, { label: 'Median', swatch: ACCENT }, { label: comparisonLabel, swatch: FLAG_VIOLET, dashed: true }, ...(limitKn !== null ? [{ label: `Your limit ${limitKn} kn`, swatch: RISK_HEX.red }] : [])];
  if (points.length === 0) {
    return <ChartFrame title={title} meta={meta} legend={legend} bare={bare}><div className="h-48 gap-hatch rounded-lg flex items-center justify-center text-[13px] text-text-3">No forecast series for this grid point yet</div></ChartFrame>;
  }
  const data = points.map((p) => ({ ...p, band: p.p10 !== null && p.p90 !== null ? [p.p10, p.p90] : null }));
  return (
    <ChartFrame title={title} meta={meta} legend={legend} bare={bare}>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid stroke={CHART_GRID} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} ticks={hourTicks(points[0].t, points[points.length - 1].t, utcOffsetMin)} tickFormatter={fmtTick} stroke={CHART_AXIS} tick={CHART_TICK} tickLine={false} axisLine={{ stroke: CHART_GRID }} minTickGap={48} />
            <YAxis stroke={CHART_AXIS} tick={CHART_TICK} tickLine={false} axisLine={false} unit=" kn" domain={[0, 'auto']} width={60} />
            <Tooltip {...CHART_TOOLTIP} labelFormatter={(t) => fmtTick(Number(t))} formatter={(v: unknown, name) => [Array.isArray(v) ? `${v[0]} to ${v[1]} kn` : `${v} kn`, name]} cursor={{ stroke: '#9AA8C0', strokeDasharray: '2 2' }} />
            <Area dataKey="band" name="Likely range" stroke="none" fill={ACCENT} fillOpacity={0.18} isAnimationActive={false} connectNulls />
            <Line dataKey="p50" name="Median" stroke={ACCENT} dot={false} strokeWidth={1.75} isAnimationActive={false} connectNulls />
            <Line dataKey="cmp" name={comparisonLabel} stroke={FLAG_VIOLET} strokeDasharray="4 3" dot={false} strokeWidth={1.25} isAnimationActive={false} connectNulls />
            {limitKn !== null && <ReferenceLine y={limitKn} stroke={RISK_HEX.red} strokeWidth={1} strokeOpacity={0.9} label={{ value: `Your limit ${limitKn} kn`, fill: RISK_HEX.red, fontSize: 10, position: 'insideTopRight', fontFamily: CHART_FONT }} />}
            {etaIso && <ReferenceLine x={Date.parse(etaIso)} stroke="#E6EDF7" strokeOpacity={0.7} strokeDasharray="2 2" label={{ value: 'ETA', fill: '#E6EDF7', fontSize: 10, position: 'insideTopLeft', fontFamily: CHART_FONT }} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
