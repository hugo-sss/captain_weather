// Tiny provenance chip beside every gust value. Estimated gusts use the muted text token and explain why.
import { gustSourceChip } from '@/lib/gust-source.ts';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { cn } from '@/lib/utils.ts';

export function GustSourceChip({ source, className }: { source: string | null | undefined; className?: string }) {
  const chip = gustSourceChip(source);
  if (!chip) return null;
  const el = (
    <span className={cn('inline-flex h-[15px] items-center rounded-[3px] border px-1 text-[9px] font-medium uppercase tracking-[0.05em] leading-none align-middle whitespace-nowrap', chip.estimated ? 'border-dashed border-text-3/50 text-text-3' : 'border-border bg-bg-2 text-text-2', className)} aria-label={`gust source ${chip.label}`}>{chip.label}</span>
  );
  return <Tooltip><TooltipTrigger asChild>{el}</TooltipTrigger><TooltipContent><span className={chip.estimated ? 'text-text-2' : ''}>{chip.title}</span></TooltipContent></Tooltip>;
}
