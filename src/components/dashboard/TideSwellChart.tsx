// PRD §8.7 / §9.4: tide height and swell height on one time axis, UKC as a computed line, min_ukc shaded. Never in separate panels.
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ACCENT, FLAG_VIOLET, RISK_HEX } from '@/lib/risk-colors.ts';

export type TideSwellPoint = { t: number; tide: number | null; swell: number | null; ukc: number | null };

export function TideSwellChart({ points, minUkcM, datum, etaIso, stayEndIso }: { points: TideSwellPoint[]; minUkcM: number | null; datum: string | null; etaIso?: string | null; stayEndIso?: string | null }) {
  if (points.length === 0) return <div className="h-48 gap-hatch rounded-md border border-border flex items-center justify-center text-xs text-text-3">no tide or swell series for this waypoint (tidal layer not configured, or no marine grid point)</div>;
  const fmtT = (t: number) => { const d = new Date(t); return `${d.getUTCDate()}/${d.getUTCMonth() + 1} ${String(d.getUTCHours()).padStart(2, '0')}Z`; };
  const hasUkc = points.some((p) => p.ukc !== null);
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#23304A" strokeDasharray="2 4" />
          <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={fmtT} stroke="#66748F" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
          <YAxis stroke="#66748F" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} unit=" m" />
          <Tooltip contentStyle={{ background: '#182338', border: '1px solid #23304A', fontSize: 11 }} labelFormatter={(t) => fmtT(Number(t))} />
          {etaIso && stayEndIso && <ReferenceArea x1={Date.parse(etaIso)} x2={Date.parse(stayEndIso)} fill="#E6EDF7" fillOpacity={0.04} />}
          {hasUkc && minUkcM !== null && <ReferenceArea y1={0} y2={minUkcM} fill={RISK_HEX.red} fillOpacity={0.12} label={{ value: `min UKC ${minUkcM} m`, fill: RISK_HEX.red, fontSize: 10, position: 'insideBottomRight' }} />}
          <Area dataKey="tide" name={`tide (${datum ?? 'datum unknown'})`} stroke={ACCENT} fill={ACCENT} fillOpacity={0.2} dot={false} isAnimationActive={false} connectNulls />
          <Line dataKey="swell" name="swell" stroke={FLAG_VIOLET} dot={false} strokeWidth={1.3} isAnimationActive={false} connectNulls />
          {hasUkc && <Line dataKey="ukc" name="UKC estimate" stroke="#E6EDF7" strokeDasharray="4 3" dot={false} strokeWidth={1.2} isAnimationActive={false} connectNulls />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
