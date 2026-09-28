import type { ReactNode } from 'react';
import { Stat, type StatTone } from '@/components/ui/stat.tsx';
import { cn } from '@/lib/utils.ts';

export type Kpi = { label: string; value: ReactNode | null; aside?: ReactNode; tone?: StatTone };

/** A row of stats for the full table page: label above value, the number in mono, a short aside under it. */
export function KpiStrip({ items, className }: { items: Kpi[]; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-x-6 gap-y-4', className)}>
      {items.map((k) => <Stat key={k.label} label={k.label} value={typeof k.value === 'string' ? <span className="num">{k.value}</span> : k.value} sub={k.aside} tone={k.tone} reason="No run yet" />)}
    </div>
  );
}
