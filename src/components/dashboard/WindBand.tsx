import { windColor } from '@/lib/risk-colors.ts';
import { num } from '@/types/domain.ts';

/** p10..p90 mini band with the p50 as a tick, on a fixed 0..50 kn scale. The vessel limit is a red hairline. */
export function WindBand({ p10, p50, p90, limit, className }: { p10: unknown; p50: unknown; p90: unknown; limit?: number | null; className?: string }) {
  const a = num(p10), m = num(p50), b = num(p90);
  if (a === null || m === null || b === null) return <div className={`h-2 w-24 gap-hatch rounded-sm border border-border/60 ${className ?? ''}`} title="no atmospheric data" />;
  const x = (v: number) => `${Math.min(100, Math.max(0, (v / 50) * 100))}%`;
  return (
    <div className={`relative h-2 w-24 rounded-sm bg-bg-0 border border-border overflow-hidden ${className ?? ''}`} title={`p10 ${a} · p50 ${m} · p90 ${b} kn`} role="img" aria-label={`wind p10 ${a}, p50 ${m}, p90 ${b} knots`}>
      {[10, 20, 30, 40].map((k) => <div key={k} className="absolute top-0 bottom-0 w-px bg-border/70" style={{ left: x(k) }} />)}
      <div className="absolute top-0 bottom-0 opacity-80 rounded-[1px]" style={{ left: x(a), width: `calc(${x(b)} - ${x(a)})`, background: windColor(m) }} />
      <div className="absolute -top-px -bottom-px w-[2px] bg-text-1" style={{ left: `calc(${x(m)} - 1px)` }} />
      {limit !== null && limit !== undefined && <div className="absolute -top-px -bottom-px w-px bg-risk-red" style={{ left: x(limit) }} />}
    </div>
  );
}

export function DirArrow({ deg, spread, title, muted }: { deg: unknown; spread?: unknown; title?: string; muted?: boolean }) {
  const d = num(deg);
  if (d === null) return <span className="text-text-3">—</span>;
  const s = num(spread);
  // "from" convention: arrow points where the wind blows TO, so rotate by deg + 180.
  return (
    <span className="inline-flex items-center gap-1" title={title ?? `${Math.round(d)}° (from)${s !== null ? `, spread ±${Math.round(s)}°` : ''}`}>
      <svg width="12" height="12" viewBox="0 0 14 14" style={{ transform: `rotate(${d + 180}deg)` }} className={muted ? 'text-text-2' : 'text-text-1'} aria-hidden><path d="M7 1 L10.5 8.5 L7 6.8 L3.5 8.5 Z" fill="currentColor" /><path d="M7 6.5 V13" stroke="currentColor" strokeWidth="1.5" /></svg>
      <span className="num text-xs">{Math.round(d).toString().padStart(3, '0')}°</span>
    </span>
  );
}

export function TowardArrow({ deg }: { deg: unknown }) {
  const d = num(deg);
  if (d === null) return <span className="text-text-3">—</span>;
  return (
    <span className="inline-flex items-center gap-1" title={`sets toward ${Math.round(d)}°`}>
      <svg width="12" height="12" viewBox="0 0 14 14" style={{ transform: `rotate(${d}deg)` }} className="text-text-2" aria-hidden><path d="M7 1 L10.5 8.5 L7 6.8 L3.5 8.5 Z" fill="currentColor" /><path d="M7 6.5 V13" stroke="currentColor" strokeWidth="1.5" /></svg>
      <span className="num text-xs">{Math.round(d).toString().padStart(3, '0')}°</span>
    </span>
  );
}

const TIDE: Record<string, { glyph: string; word: string }> = { flood: { glyph: '▲', word: 'flooding' }, ebb: { glyph: '▼', word: 'ebbing' }, high: { glyph: '⏶', word: 'high water' }, low: { glyph: '⏷', word: 'low water' }, slack: { glyph: '—', word: 'slack' } };
export function TideGlyph({ state }: { state: string | null | undefined }) {
  const t = state ? TIDE[state] : undefined;
  return <span className="text-text-2 text-[11px]" title={t?.word ?? 'state unknown'} aria-label={t?.word}>{state ? t?.glyph ?? '?' : ''}</span>;
}
