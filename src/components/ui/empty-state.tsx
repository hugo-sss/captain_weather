import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils.ts';

type Props = { icon: LucideIcon; title: string; body?: ReactNode; action?: ReactNode; className?: string; compact?: boolean };

/** Icon, title, one sentence, one button. Says what to do next in plain words. */
export function EmptyState({ icon: Icon, title, body, action, className, compact }: Props) {
  return (
    <div className={cn('card flex flex-col items-center text-center', compact ? 'px-5 py-7' : 'px-6 py-10', className)}>
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-bg-2 text-text-2"><Icon className="h-5 w-5" /></span>
      <h3 className="t-section mt-3">{title}</h3>
      {body && <p className="t-caption mt-1 max-w-[46ch] text-[13px]">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
