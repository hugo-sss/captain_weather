import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils.ts';

/** Segmented control between the four passage views. The Professional table is the default and stays first. */
export function ModeTabs({ passageId, current }: { passageId: string; current: 'pro' | 'simple' | 'cmp' | 'active' }) {
  const tabs = [
    { k: 'pro', label: 'Professional', to: `/passages/${passageId}` },
    { k: 'simple', label: 'Simplified', to: `/passages/${passageId}/simple` },
    { k: 'cmp', label: 'Comparison', to: `/passages/${passageId}/comparison` },
    { k: 'active', label: 'Monitor', to: `/passages/${passageId}/active` },
  ] as const;
  return (
    <nav aria-label="View" className="flex md:inline-flex h-8 items-stretch rounded-md border border-border bg-bg-0 p-0.5 gap-0.5">
      {tabs.map((t) => (
        <Link key={t.k} to={t.to} aria-current={current === t.k ? 'page' : undefined}
          className={cn('flex-1 md:flex-none inline-flex items-center justify-center rounded-[4px] px-3 text-xs font-medium whitespace-nowrap transition-colors', current === t.k ? 'bg-bg-2 text-text-1 shadow-[inset_0_0_0_1px_#23304A]' : 'text-text-2 hover:text-text-1 hover:bg-bg-1')}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
