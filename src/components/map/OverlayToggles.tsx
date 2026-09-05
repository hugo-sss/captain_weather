import { Switch } from '@/components/ui/switch.tsx';
import type { DisplayPrefs } from '@/types/domain.ts';

/** Both overlays toggle independently (Feature 7). */
export function OverlayToggles({ prefs, update, encStatus }: { prefs: DisplayPrefs; update: (p: Partial<DisplayPrefs>) => void; encStatus?: string | null }) {
  return (
    <div className="absolute top-2 right-2 z-[1000] rounded-md border border-border bg-bg-1/90 px-2 py-1 text-[11px] space-y-1">
      <label className="flex items-center justify-between gap-3"><span>OpenSeaMap <span className="text-text-3">crowdsourced, not official</span></span><Switch checked={prefs.show_openseamap} onCheckedChange={(v) => update({ show_openseamap: v })} /></label>
      <label className="flex items-center justify-between gap-3"><span>NOAA ENC <span className="text-text-3">US only, not for navigation</span></span><Switch checked={prefs.show_noaa_enc} onCheckedChange={(v) => update({ show_noaa_enc: v })} /></label>
      {prefs.show_noaa_enc && encStatus && <div className="text-text-3 max-w-[220px]">{encStatus}</div>}
    </div>
  );
}
