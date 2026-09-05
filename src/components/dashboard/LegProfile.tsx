// Leg profile: one continuous picture of the conditions between two waypoints. Position along the leg on x
// (distance nm, ETA at each point, waypoint names at the ends); stacked lanes for wind (p50 line, p10..p90
// band, gust markers), wave Hs, current with set-toward arrows, and a squall marker row. Every point carries
// its risk_flag and each stretch is tinted by it (unknown hatched). Hover a point for the numbers, gust
// source and data gaps. Scrolls horizontally inside its own container on narrow screens.
import { useEffect, useRef, useState } from 'react';
import { ACCENT, RISK_HEX } from '@/lib/risk-colors.ts';
import type { LegPoint, LegProfileData } from '@/lib/leg-profile.ts';
import { gustSourceChip } from '@/lib/gust-source.ts';
import { fmtLocal, fmtUtc } from '@/lib/time.ts';
import { fmtNum } from '@/lib/units.ts';
import { RiskPill } from './RiskPill.tsx';
import { SquallBadge } from './SquallBadge.tsx';
import { GustSourceChip } from './GustSourceChip.tsx';
import { cn } from '@/lib/utils.ts';

type Props = {
  leg: LegProfileData; maxWindKn: number | null; maxWaveM: number | null; utcOffsetMin: number | null;
  /** print: ink-friendly, static, no hover. */
  print?: boolean; className?: string; minWidth?: number;
};

const LANES = [
  { key: 'wind', label: 'Wind kn', h: 120 },
  { key: 'wave', label: 'Hs m', h: 70 },
  { key: 'current', label: 'Cur kn', h: 56 },
  { key: 'squall', label: 'Squall', h: 26 },
] as const;
const TOP = 46, LEFT = 56, RIGHT = 26, GAP = 8, AXIS = 30;

function useWidth(min: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(min);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(min, Math.floor(e.contentRect.width))));
    ro.observe(el); setW(Math.max(min, Math.floor(el.clientWidth)));
    return () => ro.disconnect();
  }, [min]);
  return { ref, w };
}

const nice = (v: number) => (v <= 5 ? 5 : v <= 10 ? 10 : v <= 20 ? 20 : v <= 30 ? 30 : v <= 40 ? 40 : v <= 50 ? 50 : Math.ceil(v / 10) * 10);
const hhmm = (iso: string) => fmtUtc(iso).slice(6);

export function LegProfile({ leg, maxWindKn, maxWaveM, utcOffsetMin, print, className, minWidth = 640 }: Props) {
  const { ref, w } = useWidth(minWidth);
  const [hover, setHover] = useState<number | null>(null);
  const pts = leg.points;
  const n = pts.length;
  const ink = print ? '#111111' : '#E6EDF7', ink2 = print ? '#444444' : '#9AA8C0', ink3 = print ? '#777777' : '#66748F', grid = print ? '#D9D9D9' : '#1B2740', accent = print ? '#000000' : ACCENT;
  const H = TOP + LANES.reduce((s, l) => s + l.h + GAP, 0) + AXIS;
  const plotW = w - LEFT - RIGHT;
  const x = (nm: number) => LEFT + (leg.distanceNm > 0 ? (nm / leg.distanceNm) * plotW : 0);
  const laneTop: Record<string, number> = {};
  let y0 = TOP; for (const l of LANES) { laneTop[l.key] = y0; y0 += l.h + GAP; }

  // Scales.
  const windMax = nice(Math.max(10, ...pts.map((p) => Math.max(p.windP90 ?? 0, p.gustP90 ?? 0)), maxWindKn ?? 0) * 1.05);
  const waveMax = Math.max(1, Math.ceil(Math.max(...pts.map((p) => p.waveHs ?? 0), maxWaveM ?? 0) * 1.1 * 2) / 2);
  const curMax = Math.max(0.5, Math.ceil(Math.max(...pts.map((p) => p.currentKn ?? 0)) * 1.2 * 2) / 2);
  const yWind = (v: number) => laneTop.wind + LANES[0].h - (v / windMax) * LANES[0].h;
  const yWave = (v: number) => laneTop.wave + LANES[1].h - (v / waveMax) * LANES[1].h;
  const yCur = (v: number) => laneTop.current + LANES[2].h - (v / curMax) * LANES[2].h;

  // Segment boundaries (midpoints) for the risk tint.
  const bounds = n ? [0, ...pts.slice(1).map((p, j) => (pts[j].distanceNm + p.distanceNm) / 2), leg.distanceNm] : [];
  const path = (get: (p: LegPoint) => number | null, y: (v: number) => number) => {
    let d = '', open = false;
    for (const p of pts) { const v = get(p); if (v === null) { open = false; continue; } d += `${open ? 'L' : 'M'}${x(p.distanceNm).toFixed(1)} ${y(v).toFixed(1)} `; open = true; }
    return d.trim();
  };
  const bandPath = () => {
    const runs: LegPoint[][] = []; let cur: LegPoint[] = [];
    for (const p of pts) { if (p.windP10 === null || p.windP90 === null) { if (cur.length) runs.push(cur); cur = []; } else cur.push(p); }
    if (cur.length) runs.push(cur);
    return runs.filter((r) => r.length > 1).map((r) => `M${r.map((p) => `${x(p.distanceNm).toFixed(1)} ${yWind(p.windP90 as number).toFixed(1)}`).join(' L')} L${[...r].reverse().map((p) => `${x(p.distanceNm).toFixed(1)} ${yWind(p.windP10 as number).toFixed(1)}`).join(' L')} Z`).join(' ');
  };
  const arrow = (cx: number, cy: number, deg: number, size: number, colour: string, from: boolean) => (
    <g transform={`translate(${cx} ${cy}) rotate(${from ? deg + 180 : deg})`}><path d={`M0 ${-size} L${size * 0.55} ${size * 0.5} L0 ${size * 0.2} L${-size * 0.55} ${size * 0.5} Z`} fill={colour} /></g>
  );
  const bolt = (cx: number, cy: number, likely: boolean) => <path d={`M${cx - 3} ${cy - 6} L${cx + 2} ${cy - 6} L${cx - 1} ${cy - 1} L${cx + 3} ${cy - 1} L${cx - 3} ${cy + 7} L${cx - 1} ${cy + 1} L${cx - 4} ${cy + 1} Z`} fill={likely ? ink : 'none'} stroke={ink} strokeWidth={1} />;
  const hovered = hover !== null ? pts[hover] : null;
  const gapRect = (laneKey: string, p: LegPoint, j: number) => <rect key={`${laneKey}-gap-${p.id}`} x={x(bounds[j])} y={laneTop[laneKey]} width={Math.max(0, x(bounds[j + 1]) - x(bounds[j]))} height={LANES.find((l) => l.key === laneKey)!.h} fill="url(#leg-hatch)" />;
  const fromName = `${leg.from?.sequence ?? ''}. ${leg.from?.name ?? 'start'}`.trim(), toName = `${leg.to?.sequence ?? ''}. ${leg.to?.name ?? 'end'}`.trim();

  return (
    <div ref={ref} className={cn('relative w-full overflow-x-auto', className)} onMouseLeave={() => setHover(null)}>
      {n === 0 ? (
        <div className="h-40 gap-hatch rounded-md border border-dashed border-border flex items-center justify-center text-center px-6 text-xs text-text-3">no along-leg points for this leg in the latest run (compute conditions to sample the leg every ~6 h)</div>
      ) : (
        <svg width={w} height={H} className="block select-none" role="img" aria-label={`Conditions along the leg ${fromName} to ${toName}`}>
          <defs>
            <pattern id="leg-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="none" /><line x1="0" y1="0" x2="0" y2="8" stroke={ink3} strokeOpacity={print ? 0.5 : 0.25} strokeWidth="3" /></pattern>
          </defs>
          {/* Risk-tinted stretches spanning all lanes. */}
          {pts.map((p, j) => {
            const x0 = x(bounds[j]), x1 = x(bounds[j + 1]);
            const fill = p.risk === 'unknown' ? 'url(#leg-hatch)' : RISK_HEX[p.risk];
            return <rect key={`seg-${p.id}`} x={x0} y={TOP - 4} width={Math.max(0, x1 - x0)} height={H - TOP - AXIS + 4} fill={fill} fillOpacity={p.risk === 'unknown' ? 1 : print ? 0.14 : 0.11} />;
          })}
          {/* Lane frames, labels and gaps. */}
          {LANES.map((l) => (
            <g key={l.key}>
              <line x1={LEFT} x2={w - RIGHT} y1={laneTop[l.key] + l.h} y2={laneTop[l.key] + l.h} stroke={grid} />
              <text x={LEFT - 6} y={laneTop[l.key] + 10} textAnchor="end" fontSize={9} fill={ink3} fontFamily="Inter, system-ui, sans-serif" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l.label}</text>
            </g>
          ))}
          {[windMax, windMax / 2].map((v) => <g key={`wg-${v}`}><line x1={LEFT} x2={w - RIGHT} y1={yWind(v)} y2={yWind(v)} stroke={grid} strokeDasharray="2 4" /><text x={w - RIGHT + 2} y={yWind(v) + 3} fontSize={9} fill={ink3} fontFamily="JetBrains Mono, monospace">{v}</text></g>)}
          <text x={w - RIGHT + 2} y={yWave(waveMax) + 3} fontSize={9} fill={ink3} fontFamily="JetBrains Mono, monospace">{waveMax}</text>
          <text x={w - RIGHT + 2} y={yCur(curMax) + 3} fontSize={9} fill={ink3} fontFamily="JetBrains Mono, monospace">{curMax}</text>
          {pts.map((p, j) => (
            <g key={`gaps-${p.id}`}>
              {p.windP50 === null && gapRect('wind', p, j)}
              {p.waveHs === null && gapRect('wave', p, j)}
              {p.currentKn === null && gapRect('current', p, j)}
            </g>
          ))}
          {/* Vessel limits. */}
          {maxWindKn !== null && maxWindKn <= windMax && <g><line x1={LEFT} x2={w - RIGHT} y1={yWind(maxWindKn)} y2={yWind(maxWindKn)} stroke={RISK_HEX.red} strokeWidth={1} strokeOpacity={0.9} /><text x={LEFT + 4} y={yWind(maxWindKn) - 3} fontSize={9} fill={RISK_HEX.red} fontFamily="JetBrains Mono, monospace">limit {maxWindKn} kn</text></g>}
          {maxWaveM !== null && maxWaveM <= waveMax && <g><line x1={LEFT} x2={w - RIGHT} y1={yWave(maxWaveM)} y2={yWave(maxWaveM)} stroke={RISK_HEX.red} strokeWidth={1} strokeOpacity={0.9} /><text x={LEFT + 4} y={yWave(maxWaveM) - 3} fontSize={9} fill={RISK_HEX.red} fontFamily="JetBrains Mono, monospace">limit {maxWaveM} m</text></g>}
          {/* Wind lane. */}
          <path d={bandPath()} fill={accent} fillOpacity={print ? 0.12 : 0.18} stroke="none" />
          <path d={path((p) => p.windP50, yWind)} fill="none" stroke={accent} strokeWidth={1.75} />
          {pts.map((p) => p.gustP90 !== null && (
            <g key={`g-${p.id}`}>
              <line x1={x(p.distanceNm) - 4} x2={x(p.distanceNm) + 4} y1={yWind(p.gustP90)} y2={yWind(p.gustP90)} stroke={gustSourceChip(p.gustSource)?.estimated ? ink3 : ink2} strokeWidth={1.5} strokeDasharray={gustSourceChip(p.gustSource)?.estimated ? '2 2' : undefined} />
              <line x1={x(p.distanceNm)} x2={x(p.distanceNm)} y1={yWind(p.gustP90)} y2={yWind(p.windP90 ?? p.gustP90)} stroke={ink3} strokeWidth={0.75} strokeDasharray="1 2" />
            </g>
          ))}
          {pts.map((p) => p.windP50 !== null && <circle key={`w-${p.id}`} cx={x(p.distanceNm)} cy={yWind(p.windP50)} r={hover !== null && pts[hover].id === p.id ? 4.5 : 3.25} fill={print ? '#fff' : '#0B1220'} stroke={p.risk === 'unknown' ? ink3 : RISK_HEX[p.risk]} strokeWidth={2} />)}
          {/* Wave lane. */}
          <path d={path((p) => p.waveHs, yWave)} fill="none" stroke={ink2} strokeWidth={1.5} />
          {pts.map((p) => p.waveHs !== null && <circle key={`h-${p.id}`} cx={x(p.distanceNm)} cy={yWave(p.waveHs)} r={2.25} fill={ink2} />)}
          {pts.map((p) => p.swellHs !== null && <line key={`s-${p.id}`} x1={x(p.distanceNm) - 3} x2={x(p.distanceNm) + 3} y1={yWave(p.swellHs)} y2={yWave(p.swellHs)} stroke={ink3} strokeWidth={1} strokeDasharray="2 1" />)}
          {/* Current lane: speed line + set-toward arrows. */}
          <path d={path((p) => p.currentKn, yCur)} fill="none" stroke={ink2} strokeWidth={1.25} />
          {pts.map((p) => p.currentKn !== null && p.currentDir !== null && arrow(x(p.distanceNm), yCur(p.currentKn), p.currentDir, 5, ink, false))}
          {/* Squall row. */}
          {pts.map((p) => p.squall !== 'none' && <g key={`q-${p.id}`}>{bolt(x(p.distanceNm), laneTop.squall + LANES[3].h / 2, p.squall === 'likely')}<text x={x(p.distanceNm) + 7} y={laneTop.squall + LANES[3].h / 2 + 3} fontSize={9} fill={ink2} fontFamily="JetBrains Mono, monospace">{p.squall}</text></g>)}
          {/* Point columns: ETA + wind direction at the top, hairline, distance at the bottom. */}
          {pts.map((p, j) => (
            <g key={`c-${p.id}`}>
              <line x1={x(p.distanceNm)} x2={x(p.distanceNm)} y1={TOP - 4} y2={H - AXIS} stroke={ink3} strokeOpacity={0.35} strokeDasharray="2 3" />
              <text x={x(p.distanceNm)} y={14} textAnchor="middle" fontSize={10} fill={j === 0 || j === n - 1 || n <= 8 || j % 2 === 0 ? ink : 'transparent'} fontFamily="JetBrains Mono, monospace">{hhmm(p.eta)}</text>
              {p.windDir !== null && arrow(x(p.distanceNm), 27, p.windDir, 4.5, ink2, true)}
              <text x={x(p.distanceNm)} y={H - AXIS + 12} textAnchor="middle" fontSize={9} fill={ink3} fontFamily="JetBrains Mono, monospace">{p.distanceNm.toFixed(0)} nm</text>
              {!print && <rect x={x(bounds[j])} y={0} width={Math.max(0, x(bounds[j + 1]) - x(bounds[j]))} height={H} fill="transparent" onMouseEnter={() => setHover(j)} onClick={() => setHover(j)} style={{ cursor: 'crosshair' }} />}
            </g>
          ))}
          {/* Ends. */}
          <text x={LEFT} y={H - 4} fontSize={10} fill={ink} fontWeight={600} fontFamily="Inter, system-ui, sans-serif">{fromName}</text>
          <text x={w - RIGHT} y={H - 4} textAnchor="end" fontSize={10} fill={ink} fontWeight={600} fontFamily="Inter, system-ui, sans-serif">{toName}</text>
          <text x={LEFT + plotW / 2} y={H - 4} textAnchor="middle" fontSize={9} fill={ink3} fontFamily="JetBrains Mono, monospace">{leg.distanceNm.toFixed(1)} nm · {n} points</text>
        </svg>
      )}
      {hovered && !print && <PointHoverCard p={hovered} utcOffsetMin={utcOffsetMin} style={{ left: Math.min(Math.max(8, x(hovered.distanceNm) - 120), Math.max(8, w - 256)), top: TOP + 2 }} />}
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="contents"><span className="text-text-3">{k}</span><span className="num text-text-1">{v}</span></div>;

/** Compact numbers for one point: wind, gust + source, sea, current, squall, risk and data gaps. */
export function PointHoverCard({ p, utcOffsetMin, style, className }: { p: LegPoint; utcOffsetMin: number | null; style?: React.CSSProperties; className?: string }) {
  return (
    <div className={cn('absolute z-20 w-[248px] rounded-md border border-border bg-bg-2/[0.97] backdrop-blur-sm shadow-[0_8px_24px_rgba(0,0,0,0.45)] p-2.5 text-[11px] pointer-events-none', className)} style={style} role="status">
      <div className="flex items-center gap-2 mb-1.5"><span className="num text-text-1 font-medium">{p.distanceNm.toFixed(1)} nm</span><span className="num text-text-2">{fmtUtc(p.eta)}</span><span className="num text-text-3">{fmtLocal(p.eta, utcOffsetMin)}</span><span className="ml-auto"><RiskPill flag={p.risk} size="sm" /></span></div>
      <div className="grid gap-x-3 gap-y-0.5" style={{ gridTemplateColumns: 'max-content 1fr' }}>
        <Row k="wind p10/50/90" v={p.windP50 === null ? '—' : <>{fmtNum(p.windP10, 0)} / <b>{fmtNum(p.windP50, 0)}</b> / {fmtNum(p.windP90, 0)} kn{p.windDir !== null && <span className="text-text-3"> · from {Math.round(p.windDir)}°</span>}</>} />
        <Row k="gust p90" v={p.gustP90 === null ? '—' : <>{fmtNum(p.gustP90, 0)} kn <GustSourceChip source={p.gustSource} /></>} />
        <Row k="wave Hs" v={p.waveHs === null ? '—' : `${fmtNum(p.waveHs, 1)} m · ${fmtNum(p.wavePeriod, 0)} s${p.waveDir !== null ? ` · ${Math.round(p.waveDir)}°` : ''}`} />
        <Row k="swell" v={p.swellHs === null ? '—' : `${fmtNum(p.swellHs, 1)} m · ${fmtNum(p.swellPeriod, 0)} s · ${Math.round(p.swellDir ?? 0)}°`} />
        <Row k="current" v={p.currentKn === null ? '—' : `${fmtNum(p.currentKn, 1)} kn → ${Math.round(p.currentDir ?? 0)}°`} />
        <Row k="speed loss" v={p.speedLossPct === null ? '—' : `${fmtNum(p.speedLossPct, 0)} %`} />
        <Row k="comparison" v={p.cmpWind === null ? '—' : <>{fmtNum(p.cmpWind, 0)} kn / {Math.round(p.cmpDir ?? 0)}°{p.disagreement && <span className="text-flag-violet"> · diverge</span>}</>} />
        <Row k="squall" v={p.squall === 'none' ? 'none' : <SquallBadge risk={p.squall} capeJkg={p.capeJkg} precipPct={p.precipPct} size="sm" />} />
        <Row k="cape · precip" v={`${p.capeJkg === null ? '—' : Math.round(p.capeJkg) + ' J/kg'} · ${p.precipPct === null ? '—' : Math.round(p.precipPct) + ' %'}`} />
      </div>
      {p.riskReasons.length > 0 && <ul className="mt-1.5 pt-1.5 border-t border-border space-y-0.5 num text-text-2">{p.riskReasons.map((r) => <li key={r}>{r}</li>)}</ul>}
      {p.dataGaps.length > 0 && <div className="mt-1.5 pt-1.5 border-t border-border text-text-3">no data: <span className="num text-text-2">{p.dataGaps.join(', ')}</span></div>}
    </div>
  );
}
