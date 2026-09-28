import type { ReactNode } from 'react';
import { cn } from '@/lib/utils.ts';

/** Title row + legend chips over a plot. `bare` drops the card chrome when the chart already sits in a card. */
export function ChartFrame({ title, meta, legend, children, className, bare }: { title?: ReactNode; meta?: ReactNode; legend?: { label: string; swatch: string; dashed?: boolean }[]; children: ReactNode; className?: string; bare?: boolean }) {
  return (
    <div className={cn(!bare && 'card p-4', className)}>
      {(title || meta || legend) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
          {title && <span className="t-card">{title}</span>}
          {meta && <span className="t-caption">{meta}</span>}
          {legend && (
            <div className="chart-legend ml-auto">
              {legend.map((l) => <span key={l.label} className="inline-flex items-center"><span className="swatch" style={l.dashed ? { background: 'transparent', borderTop: `2px dashed ${l.swatch}`, height: 0 } : { background: l.swatch }} />{l.label}</span>)}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
