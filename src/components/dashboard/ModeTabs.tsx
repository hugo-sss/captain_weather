import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils.ts';

export function ModeTabs({ passageId, current }: { passageId: string; current: 'pro' | 'simple' | 'cmp' | 'active' }) {
  const tabs = [
    { k: 'pro', label: 'Professional', to: `/passages/${passageId}` },
    { k: 'simple', label: 'Simplified', to: `/passages/${passageId}/simple` },
    { k: 'cmp', label: 'Comparison', to: `/passages/${passageId}/comparison` },
    { k: 'active', label: 'Monitor', to: `/passages/${passageId}/active` },
  ] as const;
  return (
    <div className="inline-flex h-8 items-center rounded-md border border-border bg-bg-1 p-0.5 overflow-x-auto">
      {tabs.map((t) => <Link key={t.k} to={t.to} className={cn('rounded-sm px-3 py-1 text-xs font-medium whitespace-nowrap', current === t.k ? 'bg-bg-2 text-text-1' : 'text-text-2 hover:text-text-1')}>{t.label}</Link>)}
    </div>
  );
}
