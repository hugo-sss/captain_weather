// Shared recharts styling so every chart on the page reads as one system.
import { localClock, localDayTime } from '@/lib/plain.ts';
export const CHART_GRID = '#1B2740';
export const CHART_AXIS = '#66748F';
export const CHART_FONT = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
export const CHART_TICK = { fontSize: 10, fontFamily: CHART_FONT, fill: '#66748F' } as const;
export const CHART_TOOLTIP = { contentStyle: { background: '#182338', border: '1px solid #23304A', borderRadius: 6, fontSize: 11, fontFamily: '"JetBrains Mono", ui-monospace, monospace', boxShadow: '0 8px 24px rgba(0,0,0,0.45)', padding: '6px 10px' }, labelStyle: { color: '#9AA8C0', marginBottom: 4 }, itemStyle: { padding: 0 } } as const;
export const fmtTick = (t: number) => { const d = new Date(t); return `${d.getUTCDate()}/${d.getUTCMonth() + 1} ${String(d.getUTCHours()).padStart(2, '0')}Z`; };
/** Local-time axis tick, "Sun 14:00". A null offset means the browser's zone, like every other local time in the app. */
export const tickFormatterFor = (offsetMin: number | null | undefined) => (t: number) => localDayTime(new Date(t).toISOString(), offsetMin) ?? '';
/** Tick positions on local whole hours (1, 2, 3, 6, 12, 24 or 48 h apart) so about `target` fit across the span. */
export function hourTicks(min: number, max: number, offsetMin: number | null | undefined, target = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [];
  const off = (offsetMin ?? -new Date().getTimezoneOffset()) * 60_000;
  const spanH = (max - min) / 3_600_000;
  const step = [1, 2, 3, 6, 12, 24, 48].find((s) => spanH / s <= target) ?? 72;
  const stepMs = step * 3_600_000;
  const out: number[] = [];
  for (let t = Math.ceil((min + off) / stepMs) * stepMs - off; t <= max; t += stepMs) out.push(t);
  return out;
}
/** Local clock only, "14:00", for marker labels next to a tick that already names the day. */
export const clockFor = (offsetMin: number | null | undefined) => (t: number) => localClock(new Date(t).toISOString(), offsetMin) ?? '';
