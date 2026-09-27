import { ArrowRight, Map } from 'lucide-react';
import type { RiskFlag } from '@/types/domain.ts';
import { RISK_HEX, ACCENT } from '@/lib/risk-colors.ts';

/** Mobile: the map collapses to a header strip (PRD §9.5). Origin → destination, distance, a risk-coloured leg bar, and a toggle to reveal the map. */
export function MapHeaderStrip({ from, to, totalNm, legs, open, onToggle }: { from: string; to: string; totalNm: number; legs: { nm: number; risk: RiskFlag | null }[]; open: boolean; onToggle: () => void }) {
  const sum = legs.reduce((s, l) => s + l.nm, 0) || 1;
  return (
    <div className="bg-bg-1 px-4 py-3 md:hidden">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[13px] font-medium"><span className="truncate">{from}</span><ArrowRight className="h-3.5 w-3.5 text-text-3 shrink-0" /><span className="truncate">{to}</span></div>
          <div className="mt-1.5 flex h-1.5 gap-px overflow-hidden rounded-full bg-bg-0">
            {legs.map((l, i) => <span key={i} style={{ width: `${(l.nm / sum) * 100}%`, background: l.risk ? RISK_HEX[l.risk] : ACCENT }} />)}
          </div>
        </div>
        <span className="num text-xs text-text-2 shrink-0">{totalNm.toFixed(1)} nm</span>
        <button type="button" onClick={onToggle} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-bg-2 px-3 text-[13px] font-medium text-text-1" aria-expanded={open}><Map className="h-4 w-4 text-accent" />{open ? 'Hide map' : 'Show map'}</button>
      </div>
    </div>
  );
}
