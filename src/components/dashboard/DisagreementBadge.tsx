import { GitCompareArrows } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';

export function DisagreementBadge({ active, speedDelta, dirDelta, primary, comparison }: { active: boolean; speedDelta?: number | null; dirDelta?: number | null; primary?: string | null; comparison?: string | null }) {
  if (!active) return <span className="text-text-3">·</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 rounded-sm border border-flag-violet/50 bg-flag-violet/15 px-1.5 py-0.5 text-[11px] font-semibold text-flag-violet uppercase"><GitCompareArrows className="h-3 w-3" /> Diverge</span>
      </TooltipTrigger>
      <TooltipContent>
        {primary ?? 'primary'} vs {comparison ?? 'comparison'}: Δspeed {speedDelta ?? '—'} kn, Δdir {dirDelta ?? '—'}°. Cross-check before relying on either.
      </TooltipContent>
    </Tooltip>
  );
}
