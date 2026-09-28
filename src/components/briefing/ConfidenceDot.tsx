import type { ConfidenceLevel } from '@/types/domain.ts';
import { CONFIDENCE_HEX, CONFIDENCE_LABEL } from '@/lib/risk-colors.ts';
import { triggerWords } from '@/lib/plain.ts';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { cn } from '@/lib/utils.ts';

/** Confidence as a coloured dot, optionally with the word. The triggers behind it live in the tooltip. */
export function ConfidenceDot({ level, triggers, withLabel, className }: { level: ConfidenceLevel; triggers?: string[]; withLabel?: boolean; className?: string }) {
  const colour = CONFIDENCE_HEX[level];
  const dot = (
    <span className={cn('inline-flex items-center gap-1.5', className)} aria-label={`Confidence ${CONFIDENCE_LABEL[level]}`}>
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: colour, boxShadow: `0 0 0 3px ${colour}26` }} />
      {withLabel && <span className="text-[12px] font-medium text-text-2">{CONFIDENCE_LABEL[level]} confidence</span>}
    </span>
  );
  return (
    <Tooltip><TooltipTrigger asChild>{dot}</TooltipTrigger>
      <TooltipContent>
        <div className="font-medium">{CONFIDENCE_LABEL[level]} confidence</div>
        {triggers?.length ? <ul className="list-disc pl-3 mt-0.5 text-text-2">{triggers.map((t) => <li key={t}>{triggerWords(t)}</li>)}</ul> : <div className="text-text-2">Nothing lowered it: short lead time, models agree, no data gaps.</div>}
      </TooltipContent></Tooltip>
  );
}
