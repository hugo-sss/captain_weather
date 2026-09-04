// Hero card for the briefing (Simplified mode) and the collapsible panel in Professional mode.
// Never shows unvalidated text. Raw data is always one tap away.
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import type { BriefingRow, ConfidenceLevel } from '@/types/domain.ts';
import { briefingDisplay } from '@/hooks/useBriefing.ts';
import { ConfidenceDot } from './ConfidenceDot.tsx';
import { MaterialChangesBanner, type MaterialChange } from './MaterialChangesBanner.tsx';
import { Button } from '@/components/ui/button.tsx';
import { fmtAge, fmtUtc } from '@/lib/time.ts';

type Props = { briefing: BriefingRow | null; busy: boolean; error: string | null; onGenerate: () => void; passageId: string; tableHref?: string; compact?: boolean };

export function BriefingCard({ briefing, busy, error, onGenerate, passageId, tableHref, compact }: Props) {
  const d = briefingDisplay(briefing);
  const notes = (briefing?.suggested_departure_windows as { start: string; end: string; reason: string }[] | null) ?? [];
  const perLeg = ((briefing?.input_snapshot as { legs?: unknown[] } | null)?.legs ? [] : []) as never[];
  void perLeg; void passageId;
  return (
    <section className="rounded-lg border border-border bg-bg-1 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent" />
        <h2 className="font-semibold">Briefing</h2>
        {briefing && <ConfidenceDot level={briefing.confidence_level as ConfidenceLevel} triggers={briefing.confidence_triggers as string[]} withLabel />}
        <span className="text-[11px] text-text-3 ml-auto">{briefing ? `${briefing.model_used} · ${briefing.prompt_version} · ${fmtAge(briefing.generated_at)}` : 'none yet'}</span>
        <Button size="sm" variant="secondary" onClick={onGenerate} disabled={busy}>{busy ? 'Generating…' : briefing ? 'Regenerate' : 'Generate briefing'}</Button>
      </div>
      {error && <p className="text-xs text-risk-red">{error}</p>}
      {briefing?.material_changes ? <MaterialChangesBanner changes={briefing.material_changes as MaterialChange[]} /> : null}
      {d.state === 'none' && <p className="text-sm text-text-2">No briefing generated for this run. The Professional table is the source of truth either way.</p>}
      {d.state === 'unavailable' && <p className="text-sm text-risk-amber">{d.reason}</p>}
      {d.state === 'ok' && briefing && (
        <div className="space-y-3 text-sm leading-relaxed">
          <p className="whitespace-pre-line">{briefing.summary_text}</p>
          {briefing.disagreement_notes && <p className="rounded-md border border-flag-violet/40 bg-flag-violet/10 px-3 py-2 text-flag-violet">{briefing.disagreement_notes}</p>}
          {briefing.recommended_action && <p><span className="label">Worth considering</span><br />{briefing.recommended_action}</p>}
          {!compact && notes.length > 0 && (
            <div><div className="label mb-1">Departure windows the model suggests (advisory; verify against official forecasts)</div>
              <ul className="space-y-0.5 num text-xs">{notes.map((w, i) => <li key={i}>{fmtUtc(w.start)} → {fmtUtc(w.end)} <span className="text-text-2 font-sans">{w.reason}</span></li>)}</ul></div>
          )}
        </div>
      )}
      {tableHref && <Link to={tableHref} className="text-xs text-accent">Show the table (raw data)</Link>}
    </section>
  );
}
