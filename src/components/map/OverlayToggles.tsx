import { Switch } from '@/components/ui/switch.tsx';
import type { DisplayPrefs } from '@/types/domain.ts';

/** Both overlays toggle independently (Feature 7). Sits over the map, top right. */
export function OverlayToggles({ prefs, update, encStatus }: { prefs: DisplayPrefs; update: (p: Partial<DisplayPrefs>) => void; encStatus?: string | null }) {
  return (
    <div className="absolute top-2 right-2 z-[1000] rounded-md border border-border bg-bg-1/95 backdrop-blur-sm px-2.5 py-1.5 text-[11px] space-y-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.35)]">
      <label className="flex items-center justify-between gap-3 cursor-pointer"><span className="text-text-1">OpenSeaMap <span className="text-text-3">crowdsourced, not official</span></span><Switch checked={prefs.show_openseamap} onCheckedChange={(v) => update({ show_openseamap: v })} aria-label="OpenSeaMap overlay" /></label>
      <label className="flex items-center justify-between gap-3 cursor-pointer"><span className="text-text-1">NOAA ENC <span className="text-text-3">US only, not for navigation</span></span><Switch checked={prefs.show_noaa_enc} onCheckedChange={(v) => update({ show_noaa_enc: v })} aria-label="NOAA ENC overlay" /></label>
      {prefs.show_noaa_enc && encStatus && <div className="text-text-3 max-w-[220px] border-t border-border pt-1">{encStatus}</div>}
    </div>
  );
}

/** Route colour key for risk-coloured maps. */
export function RiskLegend() {
  const items = [['#34D399', 'green'], ['#FBBF24', 'amber'], ['#F87171', 'red'], ['#2DD4BF', 'no run']];
  return (
    <div className="absolute bottom-2 left-2 z-[1000] rounded-md border border-border bg-bg-1/95 backdrop-blur-sm px-2 py-1 text-[10px] uppercase tracking-[0.06em] text-text-2 flex items-center gap-3">
      {items.map(([c, l]) => <span key={l} className="inline-flex items-center gap-1"><span className="inline-block h-0.5 w-4 rounded" style={{ background: c }} />{l}</span>)}
    </div>
  );
}
