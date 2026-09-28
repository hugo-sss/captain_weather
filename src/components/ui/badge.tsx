import * as React from 'react';
import { cn } from '@/lib/utils.ts';
import { statusWord } from '@/lib/plain.ts';

/** Soft pill: sentence case, 12 px, no border. */
export const Badge = ({ className, ...p }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 h-[22px] text-[12px] font-medium leading-none whitespace-nowrap', className)} {...p} />
);

const STATUS: Record<string, { pill: string; dot: string }> = {
  planned: { pill: 'bg-bg-2 text-text-2', dot: 'bg-text-3' },
  active: { pill: 'bg-accent/12 text-accent', dot: 'bg-accent' },
  completed: { pill: 'bg-bg-2 text-text-3', dot: 'bg-text-3/70' },
  archived: { pill: 'bg-bg-2 text-text-3', dot: 'bg-text-3/50' },
};

/** Passage status as a word a captain uses: Planned, Underway, Completed. Underway is the only one that earns the accent. */
export const StatusBadge = ({ status, className }: { status: string; className?: string }) => {
  const s = STATUS[status] ?? STATUS.planned;
  return (
    <Badge className={cn(s.pill, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} aria-hidden />
      {statusWord(status)}
    </Badge>
  );
};
