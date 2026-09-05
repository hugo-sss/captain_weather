// Hero card for the briefing (Simplified mode) and the compact panel in Professional and Monitor modes.
// Never shows unvalidated text. Raw data is always one tap away.
import { Link } from 'react-router-dom';
import { ArrowUpRight, GitCompareArrows, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react';
import type { BriefingRow, ConfidenceLevel } from '@/types/domain.ts';
import { briefingDisplay } from '@/hooks/useBriefing.ts';
import { ConfidenceDot } from './ConfidenceDot.tsx';
import { MaterialChangesBanner, type MaterialChange } from './MaterialChangesBanner.tsx';
import { Button } from '@/components/ui/button.tsx';
import { fmtAge, fmtUtc } from '@/lib/time.ts';
import { cn } from '@/lib/utils.ts';

type Props = {
  briefing: BriefingRow | null; busy: boolean; error: string | null; onGenerate: () => void; passageId: string; tableHref?: string;
  /** compact: tighter type for side panels. hero: larger reading size. bare: no panel chrome (caller provides the frame). */
  compact?: boolean; hero?: boolean; bare?: boolean;
  /** The Monitor screen renders the banner itself above the numbers; avoid showing it twice. */
  hideMaterialChanges?: boolean;
  /** A notification-backed banner above the card is the source of truth: show one line here until it is dismissed. */
  collapseMaterialChanges?: boolean;
};

export function BriefingCard({ briefing, busy, error, onGenerate, passageId, tableHref, compact, hero, bare, hideMaterialChanges, collapseMaterialChanges }: Props) {
  const d = briefingDisplay(briefing);
  const windows = (briefing?.suggested_departure_windows as { start: string; end: string; reason: string }[] | null) ?? [];
  void passageId;
  const body = cn('space-y-3 leading-relaxed', hero ? 'text-[15px]' : compact ? 'text-[13px]' : 'text-sm');
  return (
    <section className={cn(!bare && 'panel p-4', 'space-y-3')} aria-labelledby="briefing-title">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-accent/12 border border-accent/30 text-accent"><Sparkles className="h-3.5 w-3.5" /></span>
        <h2 id="briefing-title" className="font-semibold text-[15px]">Briefing</h2>
        {briefing && <ConfidenceDot level={briefing.confidence_level as ConfidenceLevel} triggers={briefing.confidence_triggers as string[]} withLabel />}
        <span className="num text-[11px] text-text-3 ml-auto">{briefing ? `${briefing.model_used} · ${briefing.prompt_version} · ${fmtAge(briefing.generated_at)}` : 'none yet'}</span>
        <Button size="sm" variant="secondary" onClick={onGenerate} disabled={busy}><RefreshCw className={cn('h-3.5 w-3.5', busy && 'animate-spin')} />{busy ? 'Generating…' : briefing ? 'Regenerate' : 'Generate briefing'}</Button>
      </div>
      {error && <p className="text-xs text-risk-red">{error}</p>}
      {!hideMaterialChanges && briefing?.material_changes && (briefing.material_changes as MaterialChange[]).length > 0 ? (collapseMaterialChanges
        ? <p className="rounded-md border border-risk-amber/40 bg-risk-amber/10 px-3 py-1.5 text-xs text-risk-amber flex items-center gap-2"><TriangleAlert className="h-3.5 w-3.5 shrink-0" /><span><span className="num font-semibold">{(briefing.material_changes as MaterialChange[]).length}</span> material changes since the previous run, see banner above</span></p>
        : <MaterialChangesBanner changes={briefing.material_changes as MaterialChange[]} />) : null}
      {d.state === 'none' && <p className="text-sm text-text-2">No briefing generated for this run. The Professional table is the source of truth either way.</p>}
      {d.state === 'unavailable' && <p className="rounded-md border border-risk-amber/40 bg-risk-amber/10 px-3 py-2 text-sm text-risk-amber">{d.reason}</p>}
      {d.state === 'ok' && briefing && (
        <div className={body}>
          <p className="whitespace-pre-line text-text-1">{briefing.summary_text}</p>
          {briefing.disagreement_notes && (
            <div className="rounded-md border border-flag-violet/40 bg-flag-violet/10 px-3 py-2 text-flag-violet flex gap-2">
              <GitCompareArrows className="h-4 w-4 shrink-0 mt-0.5" /><p>{briefing.disagreement_notes}</p>
            </div>
          )}
          {briefing.recommended_action && (
            <div className="border-l-2 border-accent pl-3">
              <div className="label mb-1">Worth considering</div>
              <p className="text-text-1">{briefing.recommended_action}</p>
            </div>
          )}
          {!compact && windows.length > 0 && (
            <div>
              <div className="label mb-1">Departure windows the model suggests <span className="normal-case tracking-normal text-text-3">(advisory; verify against official forecasts)</span></div>
              <ul className="space-y-0.5 text-xs">{windows.map((w, i) => <li key={i} className="flex flex-wrap gap-x-2"><span className="num text-text-1">{fmtUtc(w.start)} → {fmtUtc(w.end)}</span><span className="text-text-2">{w.reason}</span></li>)}</ul>
            </div>
          )}
        </div>
      )}
      {tableHref && <Link to={tableHref} className="inline-flex items-center gap-1 text-xs text-accent hover:underline underline-offset-2">Show the table (raw data) <ArrowUpRight className="h-3 w-3" /></Link>}
    </section>
  );
}
