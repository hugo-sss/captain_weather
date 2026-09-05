import type { ConfidenceLevel } from '@/types/domain.ts';
import { CONFIDENCE_HEX, CONFIDENCE_LABEL } from '@/lib/risk-colors.ts';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';

export function ConfidenceDot({ level, triggers, withLabel }: { level: ConfidenceLevel; triggers?: string[]; withLabel?: boolean }) {
  const dot = (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: CONFIDENCE_HEX[level] }} />
      {withLabel && <span className="text-xs">{CONFIDENCE_LABEL[level]}</span>}
    </span>
  );
  return (
    <Tooltip><TooltipTrigger asChild>{dot}</TooltipTrigger>
      <TooltipContent>Confidence {CONFIDENCE_LABEL[level].toLowerCase()}{triggers?.length ? `: ${triggers.join(', ')}` : ' (no triggers fired)'}</TooltipContent></Tooltip>
  );
}
