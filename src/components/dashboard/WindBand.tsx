import { windColor } from '@/lib/risk-colors.ts';
import { num } from '@/types/domain.ts';

/** p10..p90 mini band with the p50 as a tick, on a fixed 0..50 kn scale. */
export function WindBand({ p10, p50, p90, limit }: { p10: unknown; p50: unknown; p90: unknown; limit?: number | null }) {
  const a = num(p10), m = num(p50), b = num(p90);
  if (a === null || m === null || b === null) return <div className="h-3 w-24 gap-hatch rounded-sm" title="no atmospheric data" />;
  const x = (v: number) => `${Math.min(100, Math.max(0, (v / 50) * 100))}%`;
  return (
    <div className="relative h-3 w-24 rounded-sm bg-bg-0 border border-border overflow-hidden" title={`p10 ${a} · p50 ${m} · p90 ${b} kn`}>
      <div className="absolute top-0 bottom-0 opacity-70" style={{ left: x(a), width: `calc(${x(b)} - ${x(a)})`, background: windColor(m) }} />
      <div className="absolute top-0 bottom-0 w-0.5 bg-text-1" style={{ left: x(m) }} />
      {limit !== null && limit !== undefined && <div className="absolute top-0 bottom-0 w-px bg-risk-red" style={{ left: x(limit) }} />}
    </div>
  );
}

export function DirArrow({ deg, spread, title }: { deg: unknown; spread?: unknown; title?: string }) {
  const d = num(deg);
  if (d === null) return <span className="text-text-3">—</span>;
  const s = num(spread);
  // "from" convention: arrow points where the wind blows TO, so rotate by deg + 180.
  return (
    <span className="inline-flex items-center gap-1" title={title ?? `${Math.round(d)}° (from)${s !== null ? `, spread ±${Math.round(s)}°` : ''}`}>
      <svg width="14" height="14" viewBox="0 0 14 14" style={{ transform: `rotate(${d + 180}deg)` }} className="text-text-1"><path d="M7 1 L10 8 L7 6.5 L4 8 Z" fill="currentColor" /><path d="M7 6 V13" stroke="currentColor" strokeWidth="1.5" /></svg>
      <span className="num text-xs">{Math.round(d).toString().padStart(3, '0')}°</span>
    </span>
  );
}

export function TowardArrow({ deg }: { deg: unknown }) {
  const d = num(deg);
  if (d === null) return <span className="text-text-3">—</span>;
  return (
    <span className="inline-flex items-center gap-1" title={`sets toward ${Math.round(d)}°`}>
      <svg width="14" height="14" viewBox="0 0 14 14" style={{ transform: `rotate(${d}deg)` }} className="text-text-2"><path d="M7 1 L10 8 L7 6.5 L4 8 Z" fill="currentColor" /><path d="M7 6 V13" stroke="currentColor" strokeWidth="1.5" /></svg>
      <span className="num text-xs">{Math.round(d).toString().padStart(3, '0')}°</span>
    </span>
  );
}

export function TideGlyph({ state }: { state: string | null | undefined }) {
  const map: Record<string, string> = { flood: '▲', ebb: '▼', high: '⏶', low: '⏷', slack: '—' };
  return <span className="text-text-2 text-xs" title={state ?? 'state unknown'}>{state ? map[state] ?? '?' : ''}</span>;
}
