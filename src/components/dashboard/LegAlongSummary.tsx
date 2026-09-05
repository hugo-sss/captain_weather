// Compact along-leg summary for a LegRow / LegCard: max wind p90, max Hs, worst risk pill, squall icon
// when any point is possible/likely, and the sea-state ETA delta when eta_planned differs from eta.
import { Waves } from 'lucide-react';
import type { LegSummary } from '@/lib/leg-profile.ts';
import { fmtEtaDelta } from '@/lib/leg-profile.ts';
import { fmtNum } from '@/lib/units.ts';
import { RiskPill } from './RiskPill.tsx';
import { SquallBadge } from './SquallBadge.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { cn } from '@/lib/utils.ts';

export function LegAlongSummary({ summary, etaDeltaMin, speedLossPct, className, stacked }: { summary: LegSummary | null; etaDeltaMin: number | null; speedLossPct?: number | null; className?: string; stacked?: boolean }) {
  if (!summary) return <span className={cn('text-[11px] text-text-3', className)} title="no along-leg points in this run">—</span>;
  const wp = summary.worstPoint;
  return (
    <span className={cn('inline-flex items-center gap-x-2 gap-y-1 text-xs', stacked ? 'flex-wrap' : 'whitespace-nowrap', className)}>
      <span className="num" title="max wind p90 along the leg">{fmtNum(summary.maxWindP90, 0)}<span className="text-text-3 text-[11px] font-sans ml-0.5">kn</span></span>
      <span className="num" title="max significant wave height along the leg">{summary.maxHs === null ? <span className="text-text-3">—</span> : <>{fmtNum(summary.maxHs, 1)}<span className="text-text-3 text-[11px] font-sans ml-0.5">m</span></>}</span>
      <RiskPill flag={summary.worstRisk} reasons={wp?.riskReasons} size="sm" />
      <SquallBadge risk={summary.worstSquall} capeJkg={wp?.capeJkg} precipPct={wp?.precipPct} size="sm" />
      {etaDeltaMin !== null && <EtaDelta minutes={etaDeltaMin} speedLossPct={speedLossPct ?? summary.meanSpeedLossPct} />}
    </span>
  );
}

export function EtaDelta({ minutes, speedLossPct }: { minutes: number; speedLossPct: number | null | undefined }) {
  const el = <span className="inline-flex items-center gap-1 num text-[11px] text-text-2 whitespace-nowrap"><Waves className="h-3 w-3 text-text-3" />{fmtEtaDelta(minutes)} <span className="font-sans text-text-3">sea state</span></span>;
  return <Tooltip><TooltipTrigger asChild>{el}</TooltipTrigger><TooltipContent>ETA {fmtEtaDelta(minutes)} against the planned-speed ETA{speedLossPct !== null && speedLossPct !== undefined ? <>: mean speed loss <span className="num">{fmtNum(speedLossPct, 0)} %</span> on this leg from the sea state</> : null}.</TooltipContent></Tooltip>;
}
