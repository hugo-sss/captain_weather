import { Switch } from '@/components/ui/switch.tsx';
import type { DisplayPrefs } from '@/types/domain.ts';

/** Both overlays toggle independently (Feature 7). Sits over the map, top right. */
export function OverlayToggles({ prefs, update, encStatus }: { prefs: DisplayPrefs; update: (p: Partial<DisplayPrefs>) => void; encStatus?: string | null }) {
  return (
    <div className="absolute top-2 right-2 z-[1000] rounded-lg border border-border-soft bg-bg-1/95 backdrop-blur-sm px-3 py-2 text-[12px] space-y-2 shadow-card">
      <label className="flex items-center justify-between gap-3 cursor-pointer"><span className="text-text-1">OpenSeaMap <span className="text-text-3">crowdsourced, not official</span></span><Switch checked={prefs.show_openseamap} onCheckedChange={(v) => update({ show_openseamap: v })} aria-label="OpenSeaMap overlay" /></label>
      <label className="flex items-center justify-between gap-3 cursor-pointer"><span className="text-text-1">NOAA ENC <span className="text-text-3">US only, not for navigation</span></span><Switch checked={prefs.show_noaa_enc} onCheckedChange={(v) => update({ show_noaa_enc: v })} aria-label="NOAA ENC overlay" /></label>
      {prefs.show_noaa_enc && encStatus && <div className="text-text-3 max-w-[220px] border-t border-border pt-1">{encStatus}</div>}
    </div>
  );
}

/** Route colour key for risk-coloured maps. With along-leg segments the line changes colour between points; `no data` is dashed. */
export function RiskLegend({ segmented }: { segmented?: boolean }) {
  const items: [string, string, string?][] = [['#34D399', 'Green'], ['#FBBF24', 'Amber'], ['#F87171', 'Red'], ...(segmented ? [['#66748F', 'No data', 'dashed'] as [string, string, string]] : []), ['#2DD4BF', segmented ? 'No leg points' : 'Not checked']];
  return (
    <div className="absolute bottom-2 left-2 z-[1000] rounded-lg border border-border-soft bg-bg-1/95 backdrop-blur-sm px-2.5 py-1.5 text-[11px] text-text-2 flex flex-wrap items-center gap-x-3 gap-y-1 max-w-[calc(100%-16px)]">
      {segmented && <span className="text-text-3">Route by point</span>}
      {items.map(([c, l, d]) => <span key={l} className="inline-flex items-center gap-1"><span className="inline-block h-0.5 w-4 rounded" style={d ? { background: `repeating-linear-gradient(90deg, ${c} 0 3px, transparent 3px 6px)` } : { background: c }} />{l}</span>)}
    </div>
  );
}
