import type { RiskFlag } from '@/types/domain.ts';
import { RISK_CLASS, RISK_LABEL } from '@/lib/risk-colors.ts';
import { cn } from '@/lib/utils.ts';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';

export function RiskPill({ flag, reasons, className }: { flag: RiskFlag; reasons?: string[]; className?: string }) {
  const pill = <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide', RISK_CLASS[flag], className)}>{RISK_LABEL[flag]}</span>;
  if (!reasons?.length) return pill;
  return (
    <Tooltip><TooltipTrigger asChild>{pill}</TooltipTrigger><TooltipContent><ul className="list-disc pl-3 space-y-0.5">{reasons.map((r) => <li key={r}>{r}</li>)}</ul></TooltipContent></Tooltip>
  );
}
