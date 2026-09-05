// Tide only: one station's height curve over a window, HW/LW marked with time and height, datum label,
// a "now" marker and waypoint ETA markers. No swell, no UKC (that is the paired TideSwellChart).
// Tide here is always station data (forecast_tidal or point-tide), never a model sea level.
import { Area, CartesianGrid, ComposedChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ACCENT } from '@/lib/risk-colors.ts';
import { deriveTideExtremes, mergeExtremes, type TideExtreme, type TideSeriesPoint } from '@/lib/tide.ts';
import { ChartFrame } from './ChartFrame.tsx';
import { CHART_AXIS, CHART_GRID, CHART_TICK, CHART_TOOLTIP, fmtTick } from './chart-theme.ts';
import { cn } from '@/lib/utils.ts';

export type EtaMark = { t: number; label: string };

type Props = {
  series: TideSeriesPoint[]; extremes?: TideExtreme[] | null; datum: string | null;
  nowMs?: number | null; etaMarks?: EtaMark[];
  title?: React.ReactNode; meta?: React.ReactNode; className?: string;
  /** compact: shorter plot for the point card. bare: no ChartFrame chrome. print: ink-friendly colours. */
  compact?: boolean; bare?: boolean; print?: boolean;
};

const hhmm = (t: number) => { const d = new Date(t); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}Z`; };

export function TideChart({ series, extremes, datum, nowMs, etaMarks = [], title = 'Tide', meta, className, compact, bare, print }: Props) {
  const pts = series.filter((p) => p.height !== null).map((p) => ({ t: p.t, height: p.height as number }));
  const ext = mergeExtremes(extremes, deriveTideExtremes(series));
  const ink = print ? '#111111' : '#E6EDF7', muted = print ? '#555555' : '#9AA8C0', line = print ? '#000000' : ACCENT, grid = print ? '#DDDDDD' : CHART_GRID, axis = print ? '#777777' : CHART_AXIS;
  const tick = print ? { ...CHART_TICK, fill: '#555555' } : CHART_TICK;
  const legend = [{ label: `tide height (${datum ?? 'datum unknown'})`, swatch: print ? '#000' : 'rgba(45,212,191,0.5)' }, { label: 'HW / LW', swatch: ink }, ...(etaMarks.length ? [{ label: 'waypoint ETA', swatch: muted, dashed: true }] : [])];
  const body = pts.length === 0
    ? <div className={cn('gap-hatch rounded-md border border-dashed border-border flex items-center justify-center text-center px-6 text-xs text-text-3', compact ? 'h-28' : 'h-48')}>no station tide series for this window</div>
    : (
      <div className={compact ? 'h-32' : 'h-52'}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={pts} margin={{ top: 18, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid stroke={grid} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={fmtTick} stroke={axis} tick={tick} tickLine={false} axisLine={{ stroke: grid }} minTickGap={compact ? 64 : 48} />
            <YAxis stroke={axis} tick={tick} tickLine={false} axisLine={false} unit=" m" width={58} domain={[0, 'auto']} tickFormatter={(v: number) => v.toFixed(1)} />
            {!print && <Tooltip {...CHART_TOOLTIP} labelFormatter={(t) => fmtTick(Number(t))} formatter={(v: unknown) => [`${Number(v).toFixed(2)} m ${datum ?? ''}`.trim(), 'tide']} cursor={{ stroke: '#9AA8C0', strokeDasharray: '2 2' }} />}
            <Area dataKey="height" name="tide" stroke={line} strokeWidth={1.5} fill={line} fillOpacity={print ? 0.08 : 0.18} dot={false} isAnimationActive={false} />
            {ext.map((e) => (
              <ReferenceDot key={`${e.type}-${e.t}`} x={e.t} y={e.height} r={3} fill={ink} stroke="none" label={compact ? undefined : { value: ext.length > 6 ? `${hhmm(e.t).slice(0, 2)}Z ${e.height.toFixed(2)}` : `${e.type === 'high' ? 'HW' : 'LW'} ${hhmm(e.t)} · ${e.height.toFixed(2)} m`, position: e.type === 'high' ? 'top' : 'bottom', fill: ink, fontSize: 10, fontFamily: 'JetBrains Mono', dy: e.type === 'high' ? -2 : 2 }} />
            ))}
            {etaMarks.map((m) => <ReferenceLine key={m.label + m.t} x={m.t} stroke={muted} strokeDasharray="3 3" strokeOpacity={0.9} label={{ value: m.label, fill: muted, fontSize: 10, position: 'insideTopLeft', fontFamily: 'JetBrains Mono' }} />)}
            {nowMs !== null && nowMs !== undefined && nowMs >= pts[0].t && nowMs <= pts[pts.length - 1].t && <ReferenceLine x={nowMs} stroke={ink} strokeWidth={1.25} label={{ value: 'now', fill: ink, fontSize: 10, position: 'insideBottomRight', fontFamily: 'JetBrains Mono' }} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );
  const extremesRow = ext.length > 0 ? <div className={cn('num text-[10px] flex flex-wrap gap-x-2 gap-y-0.5 mt-1', print ? 'text-[#444]' : 'text-text-2')}>{ext.map((e) => <span key={`${e.type}-${e.t}`}><span className={print ? 'font-semibold' : e.type === 'high' ? 'text-text-1' : 'text-text-3'}>{e.type === 'high' ? 'HW' : 'LW'}</span> {fmtTick(e.t)} · {e.height.toFixed(2)} m</span>)}</div> : null;
  if (bare) return <div className={className}>{body}{extremesRow}</div>;
  return <ChartFrame title={title} meta={meta} legend={legend} className={className}>{body}{extremesRow}</ChartFrame>;
}
