import type { RiskFlag } from '@/types/domain.ts';
import { RISK_HEX } from '@/lib/risk-colors.ts';
import { plainReason, riskWord } from '@/lib/plain.ts';
import { cn } from '@/lib/utils.ts';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';

const PILL: Record<RiskFlag, string> = {
  green: 'bg-risk-green/12 text-risk-green',
  amber: 'bg-risk-amber/12 text-risk-amber',
  red: 'bg-risk-red/12 text-risk-red',
  unknown: 'bg-bg-2 text-text-2',
};

/** Coloured dot alone, for lists and captions. */
export function RiskDot({ flag, className, size = 8 }: { flag: RiskFlag | null | undefined; className?: string; size?: number }) {
  const f: RiskFlag = flag ?? 'unknown';
  return <span className={cn('inline-block rounded-full shrink-0', className)} style={{ width: size, height: size, background: RISK_HEX[f], boxShadow: f === 'unknown' ? undefined : `0 0 0 3px ${RISK_HEX[f]}22` }} aria-label={`Risk ${riskWord(f)}`} />;
}

/** Green / Amber / Red as a dot plus the word in a soft pill. "Unknown" renders as a grey dot and "No data". Reasons on hover. */
export function RiskPill({ flag, reasons, className, size = 'md' }: { flag: RiskFlag; reasons?: string[]; className?: string; size?: 'sm' | 'md' }) {
  const pill = (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full font-medium leading-none whitespace-nowrap', size === 'sm' ? 'h-5 px-2 text-[11px]' : 'h-[22px] px-2.5 text-[12px]', PILL[flag], className)} aria-label={`Risk ${riskWord(flag)}`}>
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: RISK_HEX[flag] }} aria-hidden />{riskWord(flag)}
    </span>
  );
  if (!reasons?.length) return pill;
  return (
    <Tooltip><TooltipTrigger asChild>{pill}</TooltipTrigger><TooltipContent><div className="font-medium mb-0.5">Why</div><ul className="list-disc pl-3 space-y-0.5 text-text-2">{reasons.map((r) => <li key={r}>{plainReason(r)}</li>)}</ul></TooltipContent></Tooltip>
  );
}
