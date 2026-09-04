import * as React from 'react';
import { cn } from '@/lib/utils.ts';

export const Badge = ({ className, ...p }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn('inline-flex items-center gap-1 rounded-sm border px-1.5 h-5 text-[10.5px] font-semibold uppercase tracking-[0.06em] leading-none', className)} {...p} />
);

const STATUS: Record<string, string> = {
  planned: 'border-border text-text-2 bg-bg-2',
  active: 'border-accent/50 text-accent bg-accent/10',
  completed: 'border-border text-text-3 bg-transparent',
  archived: 'border-border/60 text-text-3/80 bg-transparent',
};

/** Passage status. Active is the only one that earns the accent. */
export const StatusBadge = ({ status, className }: { status: string; className?: string }) => (
  <Badge className={cn(STATUS[status] ?? STATUS.planned, className)}>
    {status === 'active' && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
    {status}
  </Badge>
);
