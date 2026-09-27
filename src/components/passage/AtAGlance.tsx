// The hero: one sentence about the passage, the confidence behind it, and four numbers that matter.
// With no run yet it turns into three numbered steps and the primary button.
import { Check, MapPin, Sparkles } from 'lucide-react';
import type { ConfidenceLevel, RiskFlag } from '@/types/domain.ts';
import { ConfidenceDot } from '@/components/briefing/ConfidenceDot.tsx';
import { RiskPill } from '@/components/dashboard/RiskPill.tsx';
import { Stat } from '@/components/ui/stat.tsx';
import { Button } from '@/components/ui/button.tsx';
import { confidencePhrase } from '@/lib/plain.ts';
import { cn } from '@/lib/utils.ts';

export type GlanceStats = {
  departure: { value: string | null; sub: string | null };
  arrival: { value: string | null; sub: string | null };
  worst: { name: string; risk: RiskFlag; sub: string | null } | null;
  checked: { value: string | null; sub: string | null };
};

type Props = {
  headline: string;
  confidence: { level: ConfidenceLevel; triggers: string[]; where?: string | null } | null;
  stats: GlanceStats;
  noRun: boolean;
  routeLine: string;
  primary: { label: string; onClick: () => void; busy: boolean };
};

export function AtAGlance({ headline, confidence, stats, noRun, routeLine, primary }: Props) {
  if (noRun) {
    const steps = [
      { n: 1, done: true, title: 'Route set', body: routeLine, icon: <Check className="h-4 w-4" /> },
      { n: 2, done: false, title: 'Check conditions', body: 'Pulls the forecasts for every point on the route and flags each leg against your limits.', action: <Button size="sm" onClick={primary.onClick} loading={primary.busy}>{primary.busy ? 'Checking…' : primary.label}</Button> },
      { n: 3, done: false, title: 'Read the briefing', body: 'A plain-language summary written from the numbers, checked for wording before you see it.', icon: <Sparkles className="h-4 w-4" /> },
    ];
    return (
      <div className="card p-5 md:p-6">
        <h3 className="text-[20px] font-semibold leading-snug">Not checked yet</h3>
        <p className="t-caption mt-1 text-[13px]">Three steps from route to briefing.</p>
        <ol className="mt-5 grid gap-3 sm:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className={cn('tile p-4 flex flex-col gap-2', s.n === 2 && 'ring-1 ring-accent/40')}>
              <span className={cn('inline-flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold', s.done ? 'bg-risk-green/15 text-risk-green' : s.n === 2 ? 'bg-accent text-bg-0' : 'bg-bg-1 text-text-2')}>{s.done ? <Check className="h-4 w-4" /> : s.n}</span>
              <span className="t-card">{s.title}</span>
              <span className="t-caption">{s.body}</span>
              {s.action && <span className="mt-1">{s.action}</span>}
            </li>
          ))}
        </ol>
      </div>
    );
  }
  return (
    <div className="card p-5 md:p-6 grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:items-start">
      <div className="min-w-0">
        <div className="label mb-2 flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> At a glance</div>
        <p className="text-[20px] md:text-[22px] font-semibold leading-snug max-w-[34ch]">{headline}</p>
        {confidence && (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-text-2">
            <ConfidenceDot level={confidence.level} triggers={confidence.triggers} />
            {confidencePhrase(confidence.level, confidence.triggers, confidence.where)}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-5">
        <Stat label="Departure" value={stats.departure.value} sub={stats.departure.sub} />
        <Stat label="Arrival" value={stats.arrival.value} sub={stats.arrival.sub} reason="No ETA yet" />
        <Stat label="Worst stretch" value={stats.worst ? stats.worst.name : null} aside={stats.worst ? <RiskPill flag={stats.worst.risk} size="sm" /> : undefined} sub={stats.worst?.sub ?? undefined} reason="No flags yet" />
        <Stat label="Checked" value={stats.checked.value} sub={stats.checked.sub} reason="Not checked yet" />
      </div>
    </div>
  );
}
