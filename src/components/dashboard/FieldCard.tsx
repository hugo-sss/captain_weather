// FR24-style field card: small-caps label over a mono value. Hatched when null, with the reason on hover (PRD §9.4).
import { CircleDashed } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { cn } from '@/lib/utils.ts';

export function FieldCard({ label, value, unit, reason, sub, className }: { label: string; value: string | number | null | undefined; unit?: string; reason?: string; sub?: string; className?: string }) {
  const empty = value === null || value === undefined || value === '' || value === '—';
  const card = (
    <div className={cn('tile px-3 py-2 min-w-0 min-h-[58px] flex flex-col justify-center transition-colors', empty ? 'gap-hatch border-dashed border-border/80' : 'hover:border-text-3/50', className)} title={empty ? reason : undefined}>
      <div className="label truncate">{label}</div>
      {empty ? (
        <div className="mt-1 flex items-center gap-1.5 text-[12px] text-text-3"><CircleDashed className="h-3 w-3 shrink-0" /> no data</div>
      ) : (
        <div className="num text-[15px] font-medium leading-tight mt-1 truncate">{value}{unit ? <span className="font-sans text-[11px] text-text-3 ml-1 font-normal">{unit}</span> : null}</div>
      )}
      {sub && !empty && <div className="text-[11px] text-text-3 truncate mt-0.5">{sub}</div>}
    </div>
  );
  if (!empty || !reason) return card;
  return <Tooltip><TooltipTrigger asChild>{card}</TooltipTrigger><TooltipContent><span className="text-text-2">No data: </span>{reason}</TooltipContent></Tooltip>;
}
