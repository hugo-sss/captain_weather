import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils.ts';

export type PageWidth = 'narrow' | 'medium' | 'wide' | 'full';
/** Content widths so a page's header and body line up: pages use the same max-width class on their body. */
const PAGE_WIDTH: Record<PageWidth, string> = { narrow: 'max-w-3xl', medium: 'max-w-5xl', wide: 'max-w-[1280px]', full: '' };

type Props = {
  title: ReactNode;
  /** One line under the title. */
  description?: ReactNode;
  /** Back link shown above the title. */
  back?: { to: string; label: string };
  /** Right side: one primary action and, at most, an overflow menu. */
  actions?: ReactNode;
  /** Extra row under the title (a segmented control, filters). */
  children?: ReactNode;
  className?: string;
  width?: PageWidth;
};

/** One header pattern for list and form pages: 24 px title, one caption line, one primary action. */
export function PageHeader({ title, description, back, actions, children, className, width = 'full' }: Props) {
  return (
    <div className={cn('px-4 md:px-6 pt-5 pb-4 bg-bg-0', className)}>
      <div className={cn('w-full mx-auto', PAGE_WIDTH[width])}>
        {back && <Link to={back.to} className="inline-flex items-center gap-1.5 text-[13px] text-text-2 hover:text-text-1 mb-2"><ArrowLeft className="h-3.5 w-3.5" />{back.label}</Link>}
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <div className="min-w-0 flex-1">
            <h1 className="t-page truncate">{title}</h1>
            {description && <div className="t-caption mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">{description}</div>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  );
}

/** Dot separator for caption lines. */
export const Sep = () => <span aria-hidden className="text-text-3/70">·</span>;
