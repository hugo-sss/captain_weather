import { TriangleAlert } from 'lucide-react';

import type { MaterialChange } from '../../../supabase/functions/_shared/material-changes.ts';
export type { MaterialChange };

const FIELD: Record<string, string> = { risk_flag: 'risk flag', source_disagreement: 'models', confidence_level: 'confidence', wind_p90_kn: 'wind p90 (kn)', wave_height_m: 'wave (m)', tide_height_m: 'tide (m)' };
const val = (v: unknown) => (v === true ? 'diverge' : v === false ? 'agree' : String(v ?? '—'));

/** Feature 12: shown before any numbers on a re-check. */
export function MaterialChangesBanner({ changes }: { changes: MaterialChange[] | null | undefined }) {
  if (!changes || changes.length === 0) return null;
  return (
    <div role="alert" className="rounded-md border border-risk-amber/50 bg-risk-amber/10 px-3 py-2.5">
      <div className="flex items-center gap-2 font-semibold text-risk-amber text-sm"><TriangleAlert className="h-4 w-4" /> Material changes since the previous run <span className="num font-medium text-risk-amber/80">({changes.length})</span></div>
      <ul className="mt-1.5 grid gap-y-0.5 text-xs min-w-0" style={{ gridTemplateColumns: 'max-content max-content minmax(0, 1fr)' }}>
        {changes.map((c, i) => (
          <li key={i} className="contents">
            <span className="text-text-2 pr-3 whitespace-nowrap">{c.sequence !== undefined ? <span className="num text-text-3">{c.sequence}. </span> : null}{c.waypoint_name ?? ''}</span>
            <span className="text-text-3 pr-3 whitespace-nowrap">{FIELD[c.field] ?? c.field}</span>
            <span className="num min-w-0"><span className="text-text-2">{val(c.from)}</span> <span className="text-text-3">→</span> <span className="font-semibold text-text-1">{val(c.to)}</span>{c.note ? <span className="text-text-3 font-sans"> · {c.note}</span> : null}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
