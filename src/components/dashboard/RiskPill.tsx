import { CircleCheck, CircleDashed, OctagonAlert, TriangleAlert } from 'lucide-react';
import type { RiskFlag } from '@/types/domain.ts';
import { RISK_CLASS, RISK_LABEL } from '@/lib/risk-colors.ts';
import { cn } from '@/lib/utils.ts';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';

// Each flag has a distinct glyph as well as a colour, so the state never depends on colour alone.
const GLYPH: Record<RiskFlag, React.ComponentType<{ className?: string }>> = { green: CircleCheck, amber: TriangleAlert, red: OctagonAlert, unknown: CircleDashed };

export function RiskPill({ flag, reasons, className, size = 'md' }: { flag: RiskFlag; reasons?: string[]; className?: string; size?: 'sm' | 'md' }) {
  const Glyph = GLYPH[flag];
  const pill = (
    <span className={cn('inline-flex items-center gap-1 rounded-full border font-semibold uppercase tracking-[0.05em] leading-none', size === 'sm' ? 'h-[18px] px-1.5 text-[10px]' : 'h-5 px-2 text-[10.5px]', RISK_CLASS[flag], className)} aria-label={`Risk ${RISK_LABEL[flag]}`}>
      <Glyph className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />{RISK_LABEL[flag]}
    </span>
  );
  if (!reasons?.length) return pill;
  return (
    <Tooltip><TooltipTrigger asChild>{pill}</TooltipTrigger><TooltipContent><ul className="list-disc pl-3 space-y-0.5 num">{reasons.map((r) => <li key={r}>{r}</li>)}</ul></TooltipContent></Tooltip>
  );
}
