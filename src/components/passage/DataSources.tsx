// Data and sources, collapsed by default. The only place model ids, run times and target counts appear in Simple mode.
import { ChevronDown, Download, MapPin } from 'lucide-react';
import type { ConditionsRunRow, IngestTargetRow, WaypointConditionsRow } from '@/types/domain.ts';
import { Button } from '@/components/ui/button.tsx';
import { agePhrase, sourceName, utcStamp } from '@/lib/plain.ts';

type Props = {
  targets: IngestTargetRow[]; conditions: WaypointConditionsRow[]; run: ConditionsRunRow | null; legPoints: number; legCount: number;
  nowMs: number; busy: boolean; onFetchNow: () => void; onPlanTargets: () => void;
};

const LAYER_WORD: Record<string, string> = { atmospheric: 'Wind', comparison: 'Comparison wind', marine: 'Sea state and current', tidal: 'Tide' };

export function DataSources({ targets, conditions, run, legPoints, legCount, nowMs, busy, onFetchNow, onPlanTargets }: Props) {
  const first = conditions[0];
  const initFor: Record<string, string | null> = {
    atmospheric: first?.atmos_init_time ?? null,
    comparison: (first?.disagreement_detail as { comparison_init_time?: string } | null)?.comparison_init_time ?? null,
    marine: conditions.find((c) => c.marine_init_time)?.marine_init_time ?? null,
    tidal: null,
  };
  const srcFor: Record<string, string | null> = {
    atmospheric: first?.atmos_source ?? null, comparison: first?.comparison_source ?? null,
    marine: conditions.find((c) => c.marine_source)?.marine_source ?? null, tidal: conditions.find((c) => c.tidal_source)?.tidal_source ?? null,
  };
  const layers = (['atmospheric', 'comparison', 'marine', 'tidal'] as const).map((layer) => {
    const ts = targets.filter((t) => t.layer === layer);
    const fetched = ts.filter((t) => t.last_fetched_at && !t.last_error).length;
    const err = ts.find((t) => t.last_error)?.last_error ?? null;
    const last = ts.map((t) => t.last_fetched_at).filter(Boolean).sort().pop() ?? null;
    const name = sourceName(srcFor[layer]) ?? (layer === 'tidal' ? 'TidesAtlas' : null);
    const init = initFor[layer];
    const bits: string[] = [];
    if (name) bits.push(`from ${name}`);
    if (init) bits.push(`run ${utcStamp(init)}`);
    if (last) bits.push(`updated ${agePhrase(last, nowMs)}`);
    if (ts.length) bits.push(`${fetched} of ${ts.length} grid points`);
    const state: 'ok' | 'partial' | 'err' | 'none' = ts.length === 0 ? 'none' : err ? 'err' : fetched === ts.length ? 'ok' : 'partial';
    return { layer, sentence: bits.length ? `${LAYER_WORD[layer]} ${bits.join(', ')}.` : `${LAYER_WORD[layer]}: no grid points planned yet.`, err, state };
  });
  const summary = layers.filter((l) => l.state !== 'none').map((l) => `${LAYER_WORD[l.layer].toLowerCase()} from ${sourceName(srcFor[l.layer]) ?? (l.layer === 'tidal' ? 'TidesAtlas' : 'unknown')}`).join(', ');
  return (
    <details className="disclosure card">
      <summary className="flex items-center gap-3 px-5 py-4 select-none">
        <div className="min-w-0 flex-1">
          <div className="t-section">Data and sources</div>
          <div className="t-caption mt-0.5 truncate">{summary || 'Nothing fetched yet.'}</div>
        </div>
        <ChevronDown className="chev h-4 w-4 text-text-3 transition-transform shrink-0" />
      </summary>
      <div className="px-5 pb-5 space-y-4">
        <ul className="space-y-1.5 text-[13px] text-text-2">
          {layers.map((l) => (
            <li key={l.layer} className="flex items-start gap-2.5">
              <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${l.state === 'ok' ? 'bg-risk-green' : l.state === 'err' ? 'bg-risk-amber' : l.state === 'partial' ? 'bg-text-2' : 'bg-text-3/50'}`} />
              <span>{l.sentence}{l.err && <span className="text-risk-amber"> {l.err}</span>}</span>
            </li>
          ))}
          {legCount > 0 && <li className="flex items-start gap-2.5"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-risk-green" /><span>{legPoints} points sampled along {legCount} {legCount === 1 ? 'leg' : 'legs'}, about every 6 hours of the route.</span></li>}
          {run && <li className="flex items-start gap-2.5"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-text-2" /><span>Last check: {run.kind === 'recheck' ? 're-check' : 'first check'}{run.trigger === 'scheduled' ? ', scheduled' : run.trigger === 'manual' ? ', by hand' : ''}, {agePhrase(run.completed_at ?? run.created_at, nowMs)}{run.status !== 'complete' ? ` (${run.status})` : ''}.</span></li>}
        </ul>
        <div className="border-t border-border-soft pt-4">
          <div className="label mb-2">Advanced</div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={onFetchNow} disabled={busy} title="Pulls the newest model runs for every grid point now, instead of waiting for the schedule."><Download /> Refresh forecast data</Button>
            <Button size="sm" variant="ghost" onClick={onPlanTargets} disabled={busy} title="Rebuilds the grid points along the route. Only needed after editing the route by hand."><MapPin /> Recompute route points</Button>
          </div>
        </div>
      </div>
    </details>
  );
}
