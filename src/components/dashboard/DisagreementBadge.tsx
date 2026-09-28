import { GitCompareArrows } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { sourceName } from '@/lib/plain.ts';
import { cn } from '@/lib/utils.ts';

/** The one place violet appears: the primary ensemble and the comparison model disagree beyond the thresholds. Visible in Simple mode too. */
export function DisagreementBadge({ active, speedDelta, dirDelta, primary, comparison, showAgree, size = 'md', className }: { active: boolean; speedDelta?: number | null; dirDelta?: number | null; primary?: string | null; comparison?: string | null; /** Render a quiet "Models agree" when not active (tables). */ showAgree?: boolean; size?: 'sm' | 'md'; className?: string }) {
  if (!active) return showAgree ? <span className={cn('text-[11px] text-text-3', className)}>Models agree</span> : null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('inline-flex items-center gap-1 rounded-md bg-flag-violet/12 font-medium leading-none text-flag-violet whitespace-nowrap', size === 'sm' ? 'h-[18px] px-1.5 text-[11px]' : 'h-[22px] px-2 text-[12px]', className)} aria-label="Models disagree"><GitCompareArrows className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} /> Models disagree</span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="font-medium text-flag-violet mb-0.5">Models disagree here</div>
        <div className="text-text-2">{sourceName(primary) ?? 'Primary'} and {sourceName(comparison) ?? 'the comparison model'} differ by <span className="num text-text-1">{speedDelta ?? 'unknown'} kn</span> and <span className="num text-text-1">{dirDelta ?? 'unknown'}°</span>. Worth cross-checking against an official forecast.</div>
      </TooltipContent>
    </Tooltip>
  );
}
