// The briefing: a card with the validated text at reading size. Never shows unvalidated text.
// Model name and prompt version live in a tooltip on the age. Suggested windows are shown in the
// Departure windows group, not here.
import { useState } from 'react';
import { ChevronDown, GitCompareArrows, RefreshCw, Sparkles } from 'lucide-react';
import type { BriefingRow, ConfidenceLevel } from '@/types/domain.ts';
import { briefingDisplay } from '@/hooks/useBriefing.ts';
import { ConfidenceDot } from './ConfidenceDot.tsx';
import { Button } from '@/components/ui/button.tsx';
import { EmptyState } from '@/components/ui/empty-state.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { agePhrase, utcStamp } from '@/lib/plain.ts';
import { cn } from '@/lib/utils.ts';

type Props = {
  briefing: BriefingRow | null; busy: boolean; error: string | null; onGenerate: () => void;
  /** No run yet: the button explains that a check comes first. */
  canGenerate: boolean;
  nowMs: number;
  /** Underway: the previous briefing summary is offered under the text. */
  previousSummary?: string | null;
  className?: string;
};

export function BriefingCard({ briefing, busy, error, onGenerate, canGenerate, nowMs, previousSummary, className }: Props) {
  const d = briefingDisplay(briefing);
  const [showPrev, setShowPrev] = useState(false);
  const regen = <Button size="sm" variant={briefing ? 'ghost' : 'secondary'} onClick={onGenerate} loading={busy} disabled={!canGenerate}>{busy ? 'Writing…' : briefing ? <><RefreshCw /> Regenerate</> : <><Sparkles /> Generate briefing</>}</Button>;
  return (
    <section className={cn('card p-5 md:p-6', className)} aria-labelledby="briefing-title">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent/12 text-accent"><Sparkles className="h-4 w-4" /></span>
        <h2 id="briefing-title" className="t-section">Briefing</h2>
        {briefing && <ConfidenceDot level={briefing.confidence_level as ConfidenceLevel} triggers={briefing.confidence_triggers as string[]} withLabel />}
        {briefing && (
          <Tooltip>
            <TooltipTrigger asChild><span className="t-caption cursor-default">{agePhrase(briefing.generated_at, nowMs)}</span></TooltipTrigger>
            <TooltipContent>Written {utcStamp(briefing.generated_at)} by {briefing.model_used}, prompt {briefing.prompt_version}{briefing.is_recheck ? ', after a re-check' : ''}.</TooltipContent>
          </Tooltip>
        )}
        <span className="ml-auto">{regen}</span>
      </div>
      {error && <p className="mt-3 text-[13px] text-risk-red">{error}</p>}
      {d.state === 'none' && (
        <div className="mt-4"><EmptyState compact icon={Sparkles} title="No briefing yet" body={canGenerate ? 'Generate one from the latest check. It is written from the numbers and checked for wording before it is shown.' : 'Check conditions first; the briefing is written from that check.'} action={canGenerate ? regen : undefined} className="border-dashed shadow-none" /></div>
      )}
      {d.state === 'unavailable' && (
        <div className="mt-4"><EmptyState compact icon={Sparkles} title="Briefing unavailable" body={d.reason} action={regen} className="border-dashed shadow-none" /></div>
      )}
      {d.state === 'ok' && briefing && (
        <div className="mt-4 space-y-4 max-w-[68ch]">
          <p className="whitespace-pre-line text-[15px] leading-[1.6] text-text-1">{briefing.summary_text}</p>
          {briefing.disagreement_notes && (
            <div className="rounded-lg bg-flag-violet/10 px-4 py-3 text-[14px] leading-relaxed text-flag-violet flex gap-2.5">
              <GitCompareArrows className="h-4 w-4 shrink-0 mt-1" /><p>{briefing.disagreement_notes}</p>
            </div>
          )}
          {briefing.recommended_action && (
            <div className="border-l-2 border-accent pl-4">
              <div className="label mb-1 text-accent">Worth considering</div>
              <p className="text-[15px] leading-[1.6] text-text-1">{briefing.recommended_action}</p>
            </div>
          )}
          {previousSummary && (
            <div className="pt-1">
              <button type="button" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-2 hover:text-text-1" onClick={() => setShowPrev((v) => !v)} aria-expanded={showPrev}><ChevronDown className={cn('h-4 w-4 transition-transform', showPrev && 'rotate-180')} /> Previous briefing</button>
              {showPrev && <p className="mt-2 text-[14px] leading-relaxed text-text-2 whitespace-pre-line border-l-2 border-border pl-4">{previousSummary}</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
