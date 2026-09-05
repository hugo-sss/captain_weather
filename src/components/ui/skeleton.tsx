import { cn } from '@/lib/utils.ts';

export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden className={cn('skeleton', className)} />;

/** Loading states that keep the shape of the final layout, so nothing jumps when data lands. */
export function PageSkeleton({ variant = 'table' }: { variant?: 'table' | 'map' | 'form' | 'list' }) {
  return (
    <div role="status" aria-label="Loading" className="flex-1 min-h-0 flex flex-col animate-in fade-in duration-200">
      <div className="px-4 py-2.5 border-b border-border bg-bg-1 flex items-center gap-4">
        <div className="space-y-1.5"><Skeleton className="h-4 w-44" /><Skeleton className="h-2.5 w-64" /></div>
        <Skeleton className="h-8 w-72 rounded-md hidden md:block" />
        <div className="ml-auto flex gap-2"><Skeleton className="h-8 w-24" /><Skeleton className="h-8 w-32" /></div>
      </div>
      {variant === 'table' && (
        <>
          <div className="px-4 py-3 border-b border-border grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
            {Array.from({ length: 7 }).map((_, i) => <div key={i} className="space-y-1.5"><Skeleton className="h-2.5 w-16" /><Skeleton className="h-5 w-24" /></div>)}
          </div>
          <div className="px-4 py-2 space-y-0">
            <div className="flex gap-3 py-2 border-b border-border">{Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-2.5 flex-1" />)}</div>
            {Array.from({ length: 5 }).map((_, r) => (
              <div key={r} className="flex items-center gap-3 py-3 border-b border-border/70">
                <Skeleton className="h-3 w-4" /><Skeleton className="h-3 w-28" /><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-10" /><Skeleton className="h-2.5 w-24" />
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-3 flex-1" />)}<Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-3 p-4"><Skeleton className="h-52" /><Skeleton className="h-52" /></div>
        </>
      )}
      {variant === 'map' && (
        <>
          <Skeleton className="h-8 rounded-none" />
          <Skeleton className="h-[38vh] min-h-[240px] rounded-none" />
          <div className="p-4 grid gap-4 lg:grid-cols-[2fr_1fr]"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
        </>
      )}
      {variant === 'form' && (
        <div className="p-4 grid gap-4 lg:grid-cols-[280px_1fr_1fr] max-w-6xl"><Skeleton className="h-40" /><Skeleton className="h-96" /><Skeleton className="h-40" /></div>
      )}
      {variant === 'list' && (
        <div className="p-4 space-y-2 max-w-6xl">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      )}
    </div>
  );
}
