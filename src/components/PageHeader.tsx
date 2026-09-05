import type { ReactNode } from 'react';
import { cn } from '@/lib/utils.ts';

/** One header pattern for every passage screen: title + meta line, mode tabs, actions cluster. */
export function PageHeader({ title, meta, tabs, actions, className }: { title: ReactNode; meta?: ReactNode; tabs?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('px-4 py-2.5 border-b border-border bg-bg-1 flex flex-wrap items-center gap-x-5 gap-y-2 shrink-0', className)}>
      <div className="min-w-0">
        <h1 className="text-[15px] font-semibold leading-tight truncate">{title}</h1>
        {meta && <div className="text-[11px] text-text-3 leading-snug mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">{meta}</div>}
      </div>
      {tabs && <div className="order-3 w-full md:order-none md:w-auto">{tabs}</div>}
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Dot separator for meta lines. */
export const Sep = () => <span aria-hidden className="text-text-3/60">·</span>;
