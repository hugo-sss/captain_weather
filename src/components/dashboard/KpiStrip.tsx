import type { ReactNode } from 'react';
import { cn } from '@/lib/utils.ts';

export type Kpi = { label: string; value: ReactNode; aside?: ReactNode; tone?: 'default' | 'green' | 'amber' | 'red' | 'violet' };
const TONE: Record<NonNullable<Kpi['tone']>, string> = { default: 'text-text-1', green: 'text-risk-green', amber: 'text-risk-amber', red: 'text-risk-red', violet: 'text-flag-violet' };

/** Label above value, value in mono, delta or flag beside it (PRD §9.4). */
export function KpiStrip({ items, className }: { items: Kpi[]; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-x-6 gap-y-2', className)}>
      {items.map((k) => (
        <div key={k.label} className="min-w-[96px]">
          <div className="label">{k.label}</div>
          <div className={cn('num text-lg leading-tight flex items-baseline gap-2', TONE[k.tone ?? 'default'])}>{k.value}{k.aside && <span className="text-xs text-text-3 font-sans">{k.aside}</span>}</div>
        </div>
      ))}
    </div>
  );
}
