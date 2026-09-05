// PRD §9.4. Present on every screen.
export function AttributionFooter() {
  return (
    <footer className="border-t border-border bg-bg-1 px-4 py-1.5 text-[11px] text-text-3 flex flex-wrap gap-x-4 gap-y-1 shrink-0">
      <span>Weather data by <a className="text-accent" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo.com</a> (CC-BY 4.0).</span>
      <span>Tides by TidesAtlas.</span>
      <span>Charts: OpenSeaMap contributors, NOAA.</span>
      <span className="ml-auto">Not validated for navigation decisions. Supports, and does not replace, the master's passage-planning responsibility under SOLAS V/34.</span>
    </footer>
  );
}
