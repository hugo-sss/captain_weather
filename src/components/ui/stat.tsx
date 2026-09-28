import type { ReactNode } from 'react';
import { CircleDashed, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip.tsx';
import { cn } from '@/lib/utils.ts';

export type StatTone = 'default' | 'green' | 'amber' | 'red' | 'violet' | 'muted';
const TONE: Record<StatTone, string> = { default: 'text-text-1', green: 'text-risk-green', amber: 'text-risk-amber', red: 'text-risk-red', violet: 'text-flag-violet', muted: 'text-text-2' };

type Props = {
  label: ReactNode;
  /** null or undefined renders the "No data" state; the `reason` says why in a tooltip. */
  value: ReactNode | null | undefined;
  sub?: ReactNode;
  tone?: StatTone;
  /** One sentence that explains the statistic, shown on the info mark beside the label. */
  hint?: ReactNode;
  /** Why there is no data. */
  reason?: ReactNode;
  /** Small chip or marker after the value. */
  aside?: ReactNode;
  className?: string;
  size?: 'md' | 'lg';
  /** Surface: none (inside a card), tile (bg-2), or card (bg-1 with border). */
  surface?: 'none' | 'tile' | 'card';
};

/** Label, value, optional sub line. Every number the captain sees is one of these or a table cell. */
export function Stat({ label, value, sub, tone = 'default', hint, reason, aside, className, size = 'md', surface = 'none' }: Props) {
  const empty = value === null || value === undefined || value === '';
  const labelEl = (
    <div className="label flex items-center gap-1.5 min-w-0">
      <span className="truncate">{label}</span>
      {hint && (
        <Tooltip>
          <TooltipTrigger asChild><button type="button" className="inline-flex h-4 w-4 items-center justify-center rounded-full text-text-3 hover:text-text-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label="What this means"><Info className="h-3.5 w-3.5" /></button></TooltipTrigger>
          <TooltipContent>{hint}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
  const valueEl = empty ? (
    <div className="mt-1 flex items-center gap-1.5 text-[14px] text-text-3"><CircleDashed className="h-3.5 w-3.5 shrink-0" /> No data</div>
  ) : (
    <div className={cn('mt-1 flex items-center gap-2 min-w-0 leading-snug font-semibold', size === 'lg' ? 'text-[20px]' : 'text-[16px]', TONE[tone])}>
      <span className="min-w-0">{value}</span>{aside}
    </div>
  );
  const body = (
    <div className={cn('min-w-0', surface === 'tile' && 'tile px-3.5 py-3', surface === 'card' && 'card px-4 py-3.5', className)}>
      {labelEl}
      {valueEl}
      {sub && !empty && <div className="t-caption mt-0.5 min-w-0">{sub}</div>}
      {empty && reason && <div className="t-caption mt-0.5 text-text-3 min-w-0">{reason}</div>}
    </div>
  );
  return body;
}
