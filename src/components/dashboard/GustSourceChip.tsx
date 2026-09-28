// Provenance chip beside a gust value (Detailed mode and tooltips). Estimated gusts say so.
import { gustSourceChip } from '@/lib/gust-source.ts';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { cn } from '@/lib/utils.ts';

export function GustSourceChip({ source, className }: { source: string | null | undefined; className?: string }) {
  const chip = gustSourceChip(source);
  if (!chip) return null;
  const el = (
    <span className={cn('inline-flex h-[18px] items-center rounded-md bg-bg-2 px-1.5 text-[11px] font-medium leading-none align-middle whitespace-nowrap', chip.estimated ? 'text-text-3' : 'text-text-2', className)} aria-label={`gust source ${chip.label}`}>{chip.estimated ? 'Estimated' : chip.label}</span>
  );
  return <Tooltip><TooltipTrigger asChild>{el}</TooltipTrigger><TooltipContent>{chip.estimated ? `Estimated gust: ${chip.title}.` : `Gust from ${chip.title.replace('gust p90 from ', '')}.`}</TooltipContent></Tooltip>;
}
