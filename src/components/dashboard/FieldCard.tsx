// FR24-style field card. Hatched when null, with the reason on hover (PRD §9.4).
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { cn } from '@/lib/utils.ts';

export function FieldCard({ label, value, unit, reason, sub, className }: { label: string; value: string | number | null | undefined; unit?: string; reason?: string; sub?: string; className?: string }) {
  const empty = value === null || value === undefined || value === '' || value === '—';
  const card = (
    <div className={cn('rounded-md border border-border bg-bg-2 px-3 py-2 min-w-0', empty && 'gap-hatch', className)}>
      <div className="label truncate">{label}</div>
      <div className={cn('num text-base leading-tight mt-0.5 truncate', empty && 'text-text-3')}>{empty ? 'no data' : value}{!empty && unit ? <span className="text-text-3 text-xs ml-1">{unit}</span> : null}</div>
      {sub && !empty && <div className="text-[11px] text-text-3 truncate">{sub}</div>}
    </div>
  );
  if (!empty || !reason) return card;
  return <Tooltip><TooltipTrigger asChild>{card}</TooltipTrigger><TooltipContent>{reason}</TooltipContent></Tooltip>;
}
