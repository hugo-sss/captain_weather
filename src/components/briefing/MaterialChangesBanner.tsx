import { TriangleAlert } from 'lucide-react';

import type { MaterialChange } from '../../../supabase/functions/_shared/material-changes.ts';
export type { MaterialChange };

/** Feature 12: shown before any numbers on a re-check. */
export function MaterialChangesBanner({ changes }: { changes: MaterialChange[] | null | undefined }) {
  if (!changes || changes.length === 0) return null;
  return (
    <div role="alert" className="rounded-md border border-risk-amber/50 bg-risk-amber/10 px-3 py-2 text-sm">
      <div className="flex items-center gap-2 font-semibold text-risk-amber"><TriangleAlert className="h-4 w-4" /> Material changes since the previous run ({changes.length})</div>
      <ul className="mt-1 space-y-0.5 text-text-1 text-xs">
        {changes.map((c, i) => (
          <li key={i} className="num">{c.sequence !== undefined ? `${c.sequence}. ` : ''}{c.waypoint_name ?? ''} <span className="text-text-2">{c.field}</span>: {String(c.from ?? '—')} → <span className="font-semibold">{String(c.to ?? '—')}</span>{c.note ? <span className="text-text-3"> ({c.note})</span> : null}</li>
        ))}
      </ul>
    </div>
  );
}
