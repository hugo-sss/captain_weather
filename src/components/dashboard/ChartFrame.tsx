import type { ReactNode } from 'react';
import { cn } from '@/lib/utils.ts';

/** Title row + legend chips over a plot. Keeps every chart on the page reading as one system. */
export function ChartFrame({ title, meta, legend, children, className }: { title: ReactNode; meta?: ReactNode; legend?: { label: string; swatch: string; dashed?: boolean }[]; children: ReactNode; className?: string }) {
  return (
    <div className={cn('panel p-3', className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
        <span className="label text-text-2">{title}</span>
        {meta && <span className="text-[11px] text-text-3">{meta}</span>}
        {legend && (
          <div className="chart-legend ml-auto">
            {legend.map((l) => <span key={l.label} className="inline-flex items-center"><span className="swatch" style={l.dashed ? { background: 'transparent', borderTop: `2px dashed ${l.swatch}`, height: 0 } : { background: l.swatch }} />{l.label}</span>)}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
