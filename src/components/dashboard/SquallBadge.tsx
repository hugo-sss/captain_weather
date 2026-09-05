// Squall risk marker: a small icon + label, never coloured red on its own (it feeds the risk pill via
// risk_reasons). Tooltip carries the CAPE and precipitation probability behind the call.
import { CloudLightning } from 'lucide-react';
import type { SquallRisk } from '@/types/domain.ts';
import { SQUALL_LABEL } from '@/lib/leg-profile.ts';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { cn } from '@/lib/utils.ts';

export function SquallBadge({ risk, capeJkg, precipPct, size = 'md', className }: { risk: SquallRisk | string | null | undefined; capeJkg?: number | null; precipPct?: number | null; size?: 'sm' | 'md'; className?: string }) {
  if (risk !== 'possible' && risk !== 'likely') return null;
  const badge = (
    <span className={cn('inline-flex items-center gap-1 rounded-sm border border-border bg-bg-2 text-text-2 leading-none whitespace-nowrap', size === 'sm' ? 'h-[18px] px-1 text-[10px]' : 'h-5 px-1.5 text-[10.5px]', risk === 'likely' && 'text-text-1 border-text-3/70', className)} aria-label={`Squall risk ${risk}`}>
      <CloudLightning className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} /><span className="uppercase tracking-[0.05em] font-semibold">squall</span><span className="num">{SQUALL_LABEL[risk]}</span>
    </span>
  );
  return (
    <Tooltip><TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent>
        <div className="font-medium">Squall risk {risk}</div>
        <div className="num text-text-2">CAPE p50 {capeJkg === null || capeJkg === undefined ? '—' : `${Math.round(capeJkg)} J/kg`} · precip prob {precipPct === null || precipPct === undefined ? '—' : `${Math.round(precipPct)} %`}</div>
        <div className="text-text-3 mt-0.5">Convective potential from the ensemble. Counts toward the risk pill through its reasons.</div>
      </TooltipContent>
    </Tooltip>
  );
}
