import type { ReactNode } from 'react';
import { cn } from '@/lib/utils.ts';

type Props = {
  title: ReactNode;
  description?: ReactNode;
  /** Right-side controls (a segmented control, a switch, a button). They wrap under the title on narrow screens. */
  actions?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
  /** Tighter heading for sections inside a card. */
  size?: 'md' | 'sm';
};

/** A group on the page: heading, optional one-line description, optional actions, then its content. Groups are separated by space, not lines. */
export function Section({ title, description, actions, children, id, className, size = 'md' }: Props) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={cn('min-w-0', className)}>
      <div className="mb-3 flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-[260px]">
          <h2 id={id ? `${id}-title` : undefined} className={size === 'sm' ? 't-card' : 't-section'}>{title}</h2>
          {description && <p className="t-caption mt-0.5">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 max-w-full min-w-0">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
