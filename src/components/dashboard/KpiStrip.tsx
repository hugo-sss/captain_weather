import type { ReactNode } from 'react';
import { cn } from '@/lib/utils.ts';

export type Kpi = { label: string; value: ReactNode; aside?: ReactNode; tone?: 'default' | 'green' | 'amber' | 'red' | 'violet' };
const TONE: Record<NonNullable<Kpi['tone']>, string> = { default: 'text-text-1', green: 'text-risk-green', amber: 'text-risk-amber', red: 'text-risk-red', violet: 'text-flag-violet' };

/** Terminal-style KPI strip: label above value, value in mono, delta or flag beside it (PRD §9.4). Reads first on the page. */
export function KpiStrip({ items, className }: { items: Kpi[]; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap gap-y-3 lg:gap-y-2', className)}>
      {items.map((k, i) => (
        <div key={k.label} className={cn('min-w-0 lg:pr-6 lg:mr-6 lg:border-r lg:border-border', i === items.length - 1 && 'lg:border-r-0 lg:mr-0 lg:pr-0')}>
          <div className="label">{k.label}</div>
          <div className={cn('mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5', TONE[k.tone ?? 'default'])}>
            <span className="num text-[20px] font-medium leading-none tracking-tight">{k.value}</span>
            {k.aside && <span className="text-[11px] text-text-3 font-sans leading-none">{k.aside}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
