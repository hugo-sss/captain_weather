import type { ConfidenceLevel } from '@/types/domain.ts';
import { CONFIDENCE_HEX, CONFIDENCE_LABEL } from '@/lib/risk-colors.ts';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';

const TRIGGER_WORDS: Record<string, string> = {
  lead_time_gt_120h: 'lead time over 120 h', lead_time_72_120h: 'lead time 72 to 120 h', tropical_activity: 'tropical activity flagged', frontal_activity: 'frontal activity flagged',
  complex_coastal: 'complex coastal terrain', source_disagreement: 'models disagree', wide_ensemble_spread: 'wide ensemble spread',
  no_data_atmospheric: 'no atmospheric data', no_data_marine: 'no marine data', no_data_tidal: 'no tidal data', no_data_comparison: 'no comparison data',
};
const wordsFor = (t: string) => TRIGGER_WORDS[t] ?? t.replace(/_/g, ' ');

export function ConfidenceDot({ level, triggers, withLabel }: { level: ConfidenceLevel; triggers?: string[]; withLabel?: boolean }) {
  const colour = CONFIDENCE_HEX[level];
  const dot = (
    <span className="inline-flex items-center gap-1.5" aria-label={`Confidence ${CONFIDENCE_LABEL[level]}`}>
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: colour, boxShadow: `0 0 0 3px ${colour}26` }} />
      {withLabel && <span className="text-xs font-medium">{CONFIDENCE_LABEL[level]}</span>}
    </span>
  );
  return (
    <Tooltip><TooltipTrigger asChild>{dot}</TooltipTrigger>
      <TooltipContent>
        <div className="font-medium">Confidence {CONFIDENCE_LABEL[level].toLowerCase()}</div>
        {triggers?.length ? <ul className="list-disc pl-3 mt-0.5 text-text-2">{triggers.map((t) => <li key={t}>{wordsFor(t)}</li>)}</ul> : <div className="text-text-2">no triggers fired</div>}
      </TooltipContent></Tooltip>
  );
}
