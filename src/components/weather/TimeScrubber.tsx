// Bottom time bar (PRD §9.1 Windy borrow): 3-hourly steps over 72 h, day labels, a "now" marker,
// play/pause, arrow keys. When a passage is on the map its leg ETAs are ticks on the same track,
// so "time along passage" is this one control. Local time with the UTC offset shown once, and the
// model and run as a subtle caption.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils.ts';
import { fmtOffset } from '@/lib/time.ts';
import { useNow } from '@/hooks/useNow.ts';

export type EtaMark = { t: number; label: string };

type Props = { times: string[]; index: number; onChange: (i: number | ((prev: number) => number)) => void; marks?: EtaMark[]; utcOffsetMin: number | null; className?: string; compact?: boolean; /** Model, run and lead time. */ caption?: string | null; loading?: boolean; error?: string | null };

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function localParts(ms: number, offsetMin: number) {
  const d = new Date(ms + offsetMin * 60_000);
  return { day: DAYS[d.getUTCDay()], date: d.getUTCDate(), hh: String(d.getUTCHours()).padStart(2, '0'), mm: String(d.getUTCMinutes()).padStart(2, '0'), dayKey: d.toISOString().slice(0, 10) };
}

export function TimeScrubber({ times, index, onChange, marks = [], utcOffsetMin, className, compact, caption, loading, error }: Props) {
  const offset = utcOffsetMin ?? -new Date().getTimezoneOffset();
  const [playing, setPlaying] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const n = times.length;
  const t0 = n ? Date.parse(times[0]) : 0, t1 = n ? Date.parse(times[n - 1]) : 1;
  const span = Math.max(1, t1 - t0);
  const pos = (ms: number) => Math.max(0, Math.min(100, ((ms - t0) / span) * 100));
  const now = useNow(60_000);

  useEffect(() => {
    if (!playing || n === 0) return;
    const id = setInterval(() => onChange((i) => (i + 1) % n), 650);
    return () => clearInterval(id);
  }, [playing, n, onChange]);

  const fromPointer = useCallback((clientX: number) => {
    const el = track.current;
    if (!el || n === 0) return;
    const r = el.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    onChange(Math.round(f * (n - 1)));
  }, [n, onChange]);

  const onPointerDown = (e: React.PointerEvent) => { setPlaying(false); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); fromPointer(e.clientX); };
  const onPointerMove = (e: React.PointerEvent) => { if (e.buttons & 1) fromPointer(e.clientX); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); onChange((i) => Math.min(n - 1, i + 1)); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); onChange((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); onChange(0); }
    else if (e.key === 'End') { e.preventDefault(); onChange(n - 1); }
    else if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p); }
  };

  // Day boundaries in local time for the labels.
  const days: { key: string; label: string; left: number }[] = [];
  if (n) {
    let last = '';
    for (let i = 0; i < n; i++) {
      const ms = Date.parse(times[i]);
      const p = localParts(ms, offset);
      if (p.dayKey !== last) { last = p.dayKey; days.push({ key: p.dayKey, label: `${p.day} ${p.date}`, left: pos(ms) }); }
    }
  }
  const cur = n ? localParts(Date.parse(times[index] ?? times[0]), offset) : null;
  const utcCur = n ? new Date(Date.parse(times[index] ?? times[0])).toISOString().slice(11, 16) : '';

  return (
    <div className={cn('rounded-xl border border-border-soft bg-bg-1/95 backdrop-blur-sm shadow-card select-none', compact ? 'px-2.5 py-2' : 'px-4 py-2.5', className)}>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setPlaying((p) => !p)} disabled={n === 0} aria-label={playing ? 'Pause' : 'Play'} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-2 text-text-1 hover:bg-[#1F2C45] disabled:opacity-50">
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-px" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="relative h-4 text-[11px] text-text-3">
            {days.map((d) => <span key={d.key} className="absolute top-0 whitespace-nowrap" style={{ left: `${d.left}%` }}>{d.label}</span>)}
          </div>
          <div ref={track} role="slider" tabIndex={0} aria-label="Forecast time" aria-valuemin={0} aria-valuemax={Math.max(0, n - 1)} aria-valuenow={index} aria-valuetext={cur ? `${cur.day} ${cur.date} ${cur.hh}:${cur.mm}` : ''}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onKeyDown={onKey}
            className="relative h-6 cursor-pointer touch-none rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-bg-0" />
            {times.map((t, i) => <span key={t} className={cn('absolute top-1/2 h-1.5 w-px -translate-y-1/2', i % 8 === 0 ? 'bg-text-3' : 'bg-border')} style={{ left: `${pos(Date.parse(t))}%` }} />)}
            {now >= t0 && now <= t1 && <span className="absolute top-0 bottom-0 w-px bg-text-1/70" style={{ left: `${pos(now)}%` }} title="now"><span className="absolute -top-0.5 left-1/2 -translate-x-1/2 text-[9px] text-text-1 leading-none">now</span></span>}
            {marks.map((m, i) => (m.t >= t0 && m.t <= t1) && (
              <span key={i} className="absolute bottom-0 -translate-x-1/2" style={{ left: `${pos(m.t)}%` }} title={m.label}>
                <svg width="8" height="6" viewBox="0 0 8 6" aria-hidden><path d="M4 0 L8 6 L0 6 Z" fill="#2DD4BF" /></svg>
              </span>
            ))}
            {n > 0 && <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-bg-1 shadow-[0_0_0_3px_rgba(45,212,191,0.2)]" style={{ left: `${pos(Date.parse(times[index] ?? times[0]))}%` }} />}
          </div>
        </div>
        <div className="shrink-0 text-right leading-tight min-w-[92px]">
          {cur ? (
            <>
              <div className="text-[13px] font-medium text-text-1"><span className="num">{cur.day} {cur.date}, {cur.hh}:{cur.mm}</span></div>
              <div className="num text-[10px] text-text-3">{utcCur} UTC, {fmtOffset(offset)}</div>
              {!compact && (caption || error) && <div className={cn('text-[10px] mt-0.5 flex items-center justify-end gap-1', error ? 'text-risk-amber' : 'text-text-3')}>{error ? 'Data unavailable' : caption}{loading && <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse" aria-label="loading" />}</div>}
            </>
          ) : <div className="text-[12px] text-text-3">{error ? 'Data unavailable' : 'No data yet'}</div>}
        </div>
      </div>
    </div>
  );
}
