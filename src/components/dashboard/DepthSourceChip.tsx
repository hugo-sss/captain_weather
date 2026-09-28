// A GEBCO-sourced depth is a grid suggestion the user accepted, never a charted sounding: say so wherever it shows.
// This chip stays visible in Simple mode because it changes what the captain does (verify on the chart).
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { cn } from '@/lib/utils.ts';

export function DepthSourceChip({ source, className }: { source: string | null | undefined; className?: string }) {
  if (source !== 'gebco') return null;
  const el = <span className={cn('inline-flex h-[18px] items-center rounded-md bg-bg-2 px-1.5 text-[11px] font-medium leading-none text-text-2 whitespace-nowrap align-middle', className)}>Verify on chart</span>;
  return <Tooltip><TooltipTrigger asChild>{el}</TooltipTrigger><TooltipContent>This depth came from the GEBCO 2020 grid (about 450 m cells), not a charted sounding. Check the chart before relying on any clearance that uses it.</TooltipContent></Tooltip>;
}
