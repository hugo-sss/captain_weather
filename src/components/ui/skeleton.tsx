import { cn } from '@/lib/utils.ts';

export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden className={cn('skeleton', className)} />;

/** Loading states that keep the shape of the final layout, so nothing jumps when data lands. */
export function PageSkeleton({ variant = 'passage' }: { variant?: 'passage' | 'table' | 'map' | 'form' | 'list' }) {
  return (
    <div role="status" aria-label="Loading" className="flex-1 min-h-0 flex flex-col animate-in fade-in duration-200">
      <div className="px-4 md:px-6 py-4 border-b border-border-soft bg-bg-1 flex items-center gap-4">
        <div className="space-y-2"><Skeleton className="h-6 w-56" /><Skeleton className="h-3 w-72" /></div>
        <div className="ml-auto flex gap-2"><Skeleton className="h-9 w-36 rounded-lg" /><Skeleton className="h-9 w-40 rounded-lg" /><Skeleton className="h-9 w-9 rounded-lg" /></div>
      </div>
      {(variant === 'passage' || variant === 'table') && (
        <div className="p-4 md:p-6 space-y-6 max-w-7xl w-full">
          <Skeleton className="h-36 rounded-xl" />
          <div className="grid lg:grid-cols-[55fr_45fr] gap-4"><Skeleton className="h-72 rounded-xl" /><div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div></div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      )}
      {variant === 'map' && (
        <>
          <Skeleton className="h-8 rounded-none" />
          <Skeleton className="h-[38vh] min-h-[240px] rounded-none" />
          <div className="p-4 grid gap-4 lg:grid-cols-[2fr_1fr]"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
        </>
      )}
      {variant === 'form' && (
        <div className="p-4 md:p-6 grid gap-4 lg:grid-cols-[260px_1fr_1fr] max-w-7xl"><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-96 rounded-xl" /><Skeleton className="h-40 rounded-xl" /></div>
      )}
      {variant === 'list' && (
        <div className="p-4 md:p-6 space-y-3 max-w-5xl">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      )}
    </div>
  );
}
