import { useDisplayPrefs } from '@/hooks/useDisplayPrefs.ts';

/** narrative_emphasis (0..1): changes ordering and emphasis only. No data becomes unreachable at any value (Feature 6). */
export function DisplayPrefsControl() {
  const { prefs, update } = useDisplayPrefs();
  return (
    <label className="hidden md:flex items-center gap-2 label normal-case tracking-normal" title="0 = table first (raw data), 1 = briefing first. Never hides data.">
      <span>Raw</span>
      <input type="range" min={0} max={1} step={0.25} value={prefs.narrative_emphasis} onChange={(e) => update({ narrative_emphasis: Number(e.target.value) })} className="w-16 h-1 accent-[#2DD4BF] cursor-pointer" aria-label="Narrative emphasis" />
      <span>Narrative</span>
    </label>
  );
}
