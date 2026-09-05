// A GEBCO-sourced depth is a grid suggestion the user accepted, never a charted sounding: say so wherever it shows.
import { Grid2x2 } from 'lucide-react';
import { GEBCO_CHIP_LABEL } from '@/lib/gebco.ts';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { cn } from '@/lib/utils.ts';

export function DepthSourceChip({ source, className }: { source: string | null | undefined; className?: string }) {
  if (source !== 'gebco') return null;
  const el = <span className={cn('inline-flex h-[16px] items-center gap-1 rounded-[3px] border border-risk-amber/50 bg-risk-amber/10 px-1 text-[9px] font-semibold uppercase tracking-[0.05em] leading-none text-risk-amber whitespace-nowrap align-middle', className)}><Grid2x2 className="h-2.5 w-2.5" />{GEBCO_CHIP_LABEL}</span>;
  return <Tooltip><TooltipTrigger asChild>{el}</TooltipTrigger><TooltipContent>Depth accepted from the GEBCO 2020 grid (about 450 m cells). Not a charted sounding: verify on the chart before relying on any UKC that uses it.</TooltipContent></Tooltip>;
}
