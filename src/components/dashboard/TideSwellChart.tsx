// PRD §8.7 / §9.4: tide height and swell height on one time axis, UKC as a computed line, min_ukc shaded. Never in separate panels.
// UKC sits on a right-hand axis so a 20 m clearance does not flatten a 2 m tide.
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ACCENT, RISK_HEX } from '@/lib/risk-colors.ts';
import { ChartFrame } from './ChartFrame.tsx';
import { CHART_AXIS, CHART_GRID, CHART_TICK, CHART_TOOLTIP, fmtTick } from './chart-theme.ts';

export type TideSwellPoint = { t: number; tide: number | null; swell: number | null; ukc: number | null };
const SWELL = '#9AA8C0';
const UKC = '#E6EDF7';

export function TideSwellChart({ points, minUkcM, datum, etaIso, stayEndIso, title = 'Tide + swell', meta }: { points: TideSwellPoint[]; minUkcM: number | null; datum: string | null; etaIso?: string | null; stayEndIso?: string | null; title?: string; meta?: React.ReactNode }) {
  const hasUkc = points.some((p) => p.ukc !== null);
  const legend = [{ label: `tide (${datum ?? 'datum unknown'})`, swatch: 'rgba(45,212,191,0.5)' }, { label: 'swell', swatch: SWELL }, ...(hasUkc ? [{ label: 'UKC (right axis)', swatch: UKC, dashed: true }] : []), ...(hasUkc && minUkcM !== null ? [{ label: `min UKC ${minUkcM} m`, swatch: 'rgba(248,113,113,0.5)' }] : [])];
  if (points.length === 0) {
    return <ChartFrame title={title} meta={meta} legend={legend}><div className="h-48 gap-hatch rounded-md border border-dashed border-border flex items-center justify-center text-center px-6 text-xs text-text-3">no tide or swell series for this waypoint (tidal layer not configured, or no marine grid point)</div></ChartFrame>;
  }
  return (
    <ChartFrame title={title} meta={meta} legend={legend}>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 12, right: hasUkc ? -4 : 8, left: -8, bottom: 0 }}>
            <CartesianGrid stroke={CHART_GRID} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={fmtTick} stroke={CHART_AXIS} tick={CHART_TICK} tickLine={false} axisLine={{ stroke: CHART_GRID }} minTickGap={48} />
            <YAxis yAxisId="sea" stroke={CHART_AXIS} tick={CHART_TICK} tickLine={false} axisLine={false} unit=" m" width={62} domain={[0, 'auto']} tickFormatter={(v: number) => v.toFixed(1)} />
            {hasUkc && <YAxis yAxisId="ukc" orientation="right" stroke={CHART_AXIS} tick={CHART_TICK} tickLine={false} axisLine={false} unit=" m" width={56} domain={[0, 'auto']} tickFormatter={(v: number) => v.toFixed(0)} />}
            <Tooltip {...CHART_TOOLTIP} labelFormatter={(t) => fmtTick(Number(t))} formatter={(v: unknown, name) => [`${v} m`, name]} cursor={{ stroke: '#9AA8C0', strokeDasharray: '2 2' }} />
            {etaIso && stayEndIso && <ReferenceArea yAxisId="sea" x1={Date.parse(etaIso)} x2={Date.parse(stayEndIso)} fill="#E6EDF7" fillOpacity={0.05} label={{ value: 'stay', fill: '#9AA8C0', fontSize: 10, position: 'insideTop', fontFamily: 'JetBrains Mono' }} />}
            {hasUkc && minUkcM !== null && <ReferenceArea yAxisId="ukc" y1={0} y2={minUkcM} fill={RISK_HEX.red} fillOpacity={0.14} />}
            <Area yAxisId="sea" dataKey="tide" name={`tide (${datum ?? 'datum unknown'})`} stroke={ACCENT} strokeWidth={1.5} fill={ACCENT} fillOpacity={0.18} dot={false} isAnimationActive={false} connectNulls />
            <Line yAxisId="sea" dataKey="swell" name="swell" stroke={SWELL} dot={false} strokeWidth={1.5} isAnimationActive={false} connectNulls />
            {hasUkc && <Line yAxisId="ukc" dataKey="ukc" name="UKC estimate" stroke={UKC} strokeOpacity={0.85} strokeDasharray="4 3" dot={false} strokeWidth={1.25} isAnimationActive={false} connectNulls />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
