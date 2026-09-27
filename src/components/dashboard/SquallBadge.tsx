// Squall risk marker. Amber text only when likely; it feeds the risk pill through its reasons.
// Tooltip carries the CAPE and precipitation probability behind the call.
import { CloudLightning } from 'lucide-react';
import type { SquallRisk } from '@/types/domain.ts';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { cn } from '@/lib/utils.ts';

export function SquallBadge({ risk, capeJkg, precipPct, size = 'md', className }: { risk: SquallRisk | string | null | undefined; capeJkg?: number | null; precipPct?: number | null; size?: 'sm' | 'md'; className?: string }) {
  if (risk !== 'possible' && risk !== 'likely') return null;
  const badge = (
    <span className={cn('inline-flex items-center gap-1 rounded-md bg-bg-2 leading-none whitespace-nowrap font-medium', size === 'sm' ? 'h-[18px] px-1.5 text-[11px]' : 'h-[22px] px-2 text-[12px]', risk === 'likely' ? 'text-risk-amber' : 'text-text-2', className)} aria-label={`Squall risk ${risk}`}>
      <CloudLightning className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />{risk === 'likely' ? 'Squalls likely' : 'Squalls possible'}
    </span>
  );
  return (
    <Tooltip><TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent>
        <div className="font-medium">Squalls {risk}</div>
        <div className="text-text-2 mt-0.5">Convective energy (CAPE) <span className="num">{capeJkg === null || capeJkg === undefined ? 'unknown' : `${Math.round(capeJkg)} J/kg`}</span>, chance of rain <span className="num">{precipPct === null || precipPct === undefined ? 'unknown' : `${Math.round(precipPct)} %`}</span>. Counts toward the risk flag.</div>
      </TooltipContent>
    </Tooltip>
  );
}
