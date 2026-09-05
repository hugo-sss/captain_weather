import { GitCompareArrows } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';

/** The one place violet appears: primary ensemble and comparison model disagree beyond the thresholds. */
export function DisagreementBadge({ active, speedDelta, dirDelta, primary, comparison }: { active: boolean; speedDelta?: number | null; dirDelta?: number | null; primary?: string | null; comparison?: string | null }) {
  if (!active) return <span className="text-[10px] uppercase tracking-[0.05em] text-text-3/70" title="primary and comparison models agree">agree</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex h-5 items-center gap-1 rounded-sm border border-flag-violet/50 bg-flag-violet/15 px-1.5 text-[10.5px] font-semibold uppercase tracking-[0.05em] leading-none text-flag-violet" aria-label="Models diverge"><GitCompareArrows className="h-3 w-3" /> Diverge</span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="font-medium text-flag-violet mb-0.5">Models diverge</div>
        <div className="num">{primary ?? 'primary'} vs {comparison ?? 'comparison'}</div>
        <div className="num">Δspeed {speedDelta ?? '—'} kn · Δdir {dirDelta ?? '—'}°</div>
        <div className="text-text-2 mt-1">Cross-check before relying on either.</div>
      </TooltipContent>
    </Tooltip>
  );
}
