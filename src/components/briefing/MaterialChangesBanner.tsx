import { TriangleAlert, X } from 'lucide-react';
import type { MaterialChange } from '../../../supabase/functions/_shared/material-changes.ts';
import { cn } from '@/lib/utils.ts';
import { changeLine } from '@/lib/material-changes-text.ts';
export type { MaterialChange };

/** Feature 12: shown before any numbers on a re-check. Soft card with an amber rail. With `onDismiss` it can be closed, which marks the alert read. */
export function MaterialChangesBanner({ changes, meta, onDismiss, className }: { changes: MaterialChange[] | null | undefined; meta?: React.ReactNode; onDismiss?: () => void; className?: string }) {
  if (!changes || changes.length === 0) return null;
  return (
    <div role="alert" className={cn('card border-l-4 border-l-risk-amber px-4 py-3.5', className)}>
      <div className="flex items-start gap-3">
        <TriangleAlert className="h-4 w-4 text-risk-amber shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="t-card">{changes.length === 1 ? 'One thing changed since the last check' : `${changes.length} things changed since the last check`}</span>
            {meta && <span className="t-caption">{meta}</span>}
          </div>
          <ul className="mt-2 space-y-1 text-[13px] leading-snug">
            {changes.map((c, i) => { const l = changeLine(c); return (
              <li key={i} className="text-text-2">
                <span className="text-text-1 font-medium">{l.where}</span>{l.where ? ' · ' : ''}{l.what.toLowerCase()} <span className={cn(l.numeric && 'num')}>{l.from}</span> to <span className={cn('font-medium text-text-1', l.numeric && 'num')}>{l.to}</span>{l.note && <span className="text-text-3">, {l.note}</span>}
              </li>
            ); })}
          </ul>
        </div>
        {onDismiss && <button type="button" onClick={onDismiss} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-3 hover:bg-bg-2 hover:text-text-1" aria-label="Dismiss and mark read"><X className="h-4 w-4" /></button>}
      </div>
    </div>
  );
}
