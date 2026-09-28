// The front door: a live weather map that is also a home. Hover or tap to inspect, scrub time, switch
// layers, stack live radar; plan a passage on top of the same map; see your upcoming passages in the rail.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AttributionControl, CircleMarker, MapContainer, useMap, useMapEvents } from 'react-leaflet';
import { ArrowUpRight, MapPin, PanelRightClose, PanelRightOpen, Route, X } from 'lucide-react';
import { useWeatherBrowse, type BrowseView } from '@/hooks/useWeatherBrowse.ts';
import { useDisplayPrefs } from '@/hooks/useDisplayPrefs.ts';
import { usePassageSummaries } from '@/hooks/usePassageSummaries.ts';
import { useIsMobile } from '@/hooks/useMediaQuery.ts';
import { useNow } from '@/hooks/useNow.ts';
import { buildScalarGrid, buildVectorGrid, sampleCells } from '@/lib/weather-browse/field.ts';
import type { FieldKind } from '@/lib/weather-browse/ramps.ts';
import type { BrowseVar } from '@/lib/weather-browse/types.ts';
import { MODEL_LABEL } from '@/lib/weather-browse/types.ts';
import { BaseTiles, OpenSeaMapLayer } from '@/components/map/ChartOverlays.tsx';
import { DisclaimerBar } from '@/components/map/DisclaimerBar.tsx';
import { RouteLine } from '@/components/map/RouteLine.tsx';
import { WaypointMarker } from '@/components/map/WaypointMarker.tsx';
import { ColourField, FieldLegend } from '@/components/weather/ColourField.tsx';
import { WindParticles } from '@/components/weather/WindParticles.tsx';
import { LayerBar } from '@/components/weather/LayerBar.tsx';
import { MapOptions } from '@/components/weather/MapOptions.tsx';
import { TimeScrubber, type EtaMark } from '@/components/weather/TimeScrubber.tsx';
import { PointCard } from '@/components/weather/PointCard.tsx';
import { DailyStrip } from '@/components/weather/DailyStrip.tsx';
import { RadarBar, RadarTiles } from '@/components/weather/RainRadar.tsx';
import { isCoarsePointer } from '@/components/weather/mapCanvas.ts';
import { BuilderPanel } from '@/components/builder/BuilderPanel.tsx';
import { useBuilderDraft } from '@/components/builder/useBuilderDraft.ts';
import { Button } from '@/components/ui/button.tsx';
import { RiskDot } from '@/components/dashboard/RiskPill.tsx';
import { riskHeadline, whenPhrase } from '@/lib/plain.ts';
import { cn } from '@/lib/utils.ts';

const VIEW_KEY = 'cpt.weatherView.v1';
const GEO_KEY = 'cpt.geoAsked.v1';
const DEFAULT_VIEW = { lat: 7.8, lon: 98.4, zoom: 8 };
const VAR_FOR: Record<FieldKind, BrowseVar> = { wind: 'wind_speed_10m', gusts: 'wind_gusts_10m', waves: 'wave_height', swell: 'swell_wave_height', rain: 'precipitation', pressure: 'pressure_msl' };

function readView(): { lat: number; lon: number; zoom: number } | null {
  try { const v = JSON.parse(localStorage.getItem(VIEW_KEY) ?? 'null'); return v && Number.isFinite(v.lat) && Number.isFinite(v.lon) && Number.isFinite(v.zoom) ? v : null; } catch { return null; }
}

/** Reports the view (debounced 400 ms after moveend, per Open-Meteo's per-location rate weighting) and remembers it. */
function ViewSync({ onView }: { onView: (v: BrowseView) => void }) {
  const map = useMap();
  const timer = useRef<number | null>(null);
  const report = useCallback(() => {
    const b = map.getBounds(), c = map.getCenter();
    onView({ bounds: { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() }, zoom: map.getZoom(), centre: { lat: c.lat, lon: c.lng } });
    try { localStorage.setItem(VIEW_KEY, JSON.stringify({ lat: c.lat, lon: c.lng, zoom: map.getZoom() })); } catch { /* ignore */ }
  }, [map, onView]);
  useEffect(() => { report(); }, [report]);
  useMapEvents({ moveend: () => { if (timer.current) window.clearTimeout(timer.current); timer.current = window.setTimeout(report, 400); } });
  return null;
}

/** One-time browser geolocation when no view was remembered. Falls back silently to the default. */
function GeoLocate({ enabled }: { enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled || !navigator.geolocation) return;
    try { if (localStorage.getItem(GEO_KEY)) return; localStorage.setItem(GEO_KEY, '1'); } catch { /* ignore */ }
    navigator.geolocation.getCurrentPosition((pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 8), () => undefined, { timeout: 6000, maximumAge: 600_000 });
  }, [enabled, map]);
  return null;
}

/** Desktop: hover debounced 200 ms (cheap cached sample), settle at 350 ms (point fetch); click pins. Mobile: tap. */
function Pointer({ planning, onHover, onSettle, onLeave, onPlanClick }: { planning: boolean; onHover: (lat: number, lon: number, x: number, y: number) => void; onSettle: (lat: number, lon: number, pin: boolean, x: number, y: number) => void; onLeave: () => void; onPlanClick: (lat: number, lon: number) => void }) {
  const hoverT = useRef<number | null>(null), settleT = useRef<number | null>(null);
  const clear = () => { if (hoverT.current) window.clearTimeout(hoverT.current); if (settleT.current) window.clearTimeout(settleT.current); };
  useMapEvents({
    mousemove: (e) => {
      if (isCoarsePointer()) return;
      const { lat, lng } = e.latlng, { clientX: x, clientY: y } = e.originalEvent;
      clear();
      hoverT.current = window.setTimeout(() => onHover(lat, lng, x, y), 200);
      settleT.current = window.setTimeout(() => onSettle(lat, lng, false, x, y), 350);
    },
    mouseout: () => { clear(); onLeave(); },
    click: (e) => {
      clear();
      if (planning) { onPlanClick(e.latlng.lat, e.latlng.lng); return; }
      onSettle(e.latlng.lat, e.latlng.lng, true, e.originalEvent.clientX, e.originalEvent.clientY);
    },
    movestart: () => { clear(); },
  });
  useEffect(() => clear, []);
  return null;
}

/** Keeps a pinned card glued to its lat/lon while the map moves. */
function PinTracker({ lat, lon, onMove }: { lat: number; lon: number; onMove: (x: number, y: number) => void }) {
  const map = useMap();
  const update = useCallback(() => { const p = map.latLngToContainerPoint([lat, lon]); const r = map.getContainer().getBoundingClientRect(); onMove(r.left + p.x, r.top + p.y); }, [map, lat, lon, onMove]);
  useEffect(() => { update(); }, [update]);
  useMapEvents({ move: update, zoom: update, resize: update });
  return null;
}

export default function WeatherMap() {
  const wb = useWeatherBrowse();
  const { prefs, update } = useDisplayPrefs();
  const { summaries, vessels } = usePassageSummaries();
  const mobile = useIsMobile();
  const nowMs = useNow(60_000);
  const [railOpen, setRailOpen] = useState<boolean | null>(null);
  const [dailyOpen, setDailyOpen] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [saved, setSaved] = useState<{ id: string } | null>(null);
  const draft = useBuilderDraft({ passage: null, waypoints: [], vessels });
  const initial = useMemo(() => readView(), []);
  const start = initial ?? DEFAULT_VIEW;
  const open = railOpen ?? !mobile;

  const { spec, cells, timeIso, field, particles, inspect, run } = wb;
  const scalarGrid = useMemo(() => (spec && timeIso ? buildScalarGrid(spec, cells, VAR_FOR[field], timeIso) : null), [spec, cells, timeIso, field]);
  const vectorGrid = useMemo(() => (spec && timeIso && particles ? buildVectorGrid(spec, cells, timeIso, field === 'gusts' ? 'wind_gusts_10m' : 'wind_speed_10m', 'wind_direction_10m') : null), [spec, cells, timeIso, field, particles]);
  const gridValues = useMemo(() => (inspect && spec && timeIso && cells.length ? sampleCells(spec, cells, inspect.lat, inspect.lon, timeIso) : null), [inspect, spec, cells, timeIso]);
  const leadHours = run && timeIso ? Math.round((Date.parse(timeIso) - Date.parse(run.runIso)) / 3_600_000) : null;
  const marks: EtaMark[] = useMemo(() => draft.withEta.filter((w) => w.eta).map((w) => ({ t: Date.parse(w.eta!), label: `${w.sequence}. ${w.name || 'WP'} · ETA` })), [draft.withEta]);
  const utcOffset = prefs.local_utc_offset_min;
  const caption = run ? `${MODEL_LABEL[run.model]}, ${run.runLabel.replace('≈ ', 'about ')}${leadHours !== null ? `, ${leadHours >= 0 ? '+' : '-'}${Math.abs(leadHours)} h` : ''}` : MODEL_LABEL[wb.model];

  // Arrow keys scrub time anywhere on the page; Esc unpins the card.
  const { setTimeIndex, unpin } = wb;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); setTimeIndex((i) => i + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setTimeIndex((i) => i - 1); }
      else if (e.key === 'Escape') unpin();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setTimeIndex, unpin]);

  const [pinXY, setPinXY] = useState<{ x: number; y: number } | null>(null);
  const onPinMove = useCallback((x: number, y: number) => setPinXY((p) => (p && p.x === x && p.y === y ? p : { x, y })), []);
  const cardXY = inspect?.pinned && pinXY ? pinXY : inspect ? { x: inspect.x, y: inspect.y } : null;

  // On a phone the sheet gives way to the map so pins can be dropped; the floating button brings it back.
  const startPlanning = () => { setPlanning(true); setSaved(null); wb.unpin(); setRailOpen(!mobile); };
  const openRail = () => { setRailOpen(true); if (mobile) wb.unpin(); };
  const stopPlanning = () => { setPlanning(false); setSaved(null); draft.reset(); };

  const upcoming = summaries.filter((s) => s.passage.status === 'active' || s.passage.status === 'planned').sort((a, b) => (a.passage.status === 'active' ? -1 : b.passage.status === 'active' ? 1 : Date.parse(a.passage.planned_departure) - Date.parse(b.passage.planned_departure))).slice(0, 3);

  const rail = (
    <div className="p-4 space-y-4">
      <DailyStrip daily={wb.daily} target={wb.dailyTarget} pinned={!!inspect?.pinned} open={dailyOpen} onToggle={() => setDailyOpen((v) => !v)} />
      {planning ? (
        <div className="card"><BuilderPanel draft={draft} vessels={vessels} embedded saved={saved} onSaved={(pid) => setSaved({ id: pid })} onCancel={stopPlanning} className="min-h-0" /></div>
      ) : (
        <>
          <div className="card p-4 space-y-3">
            <div>
              <h2 className="t-card flex items-center gap-2"><Route className="h-4 w-4 text-accent" /> Plan a passage</h2>
              <p className="t-caption mt-1">Drop two pins on this map. The route stays on the weather and its leg ETAs become ticks on the time bar.</p>
            </div>
            <Button onClick={startPlanning} className="w-full"><MapPin /> Plan a passage</Button>
          </div>
          <div className="card p-4">
            <div className="flex items-baseline justify-between mb-2"><h2 className="t-card">Your passages</h2><Link to="/passages" className="text-[12px] font-medium text-accent hover:underline underline-offset-2 inline-flex items-center gap-0.5">All passages <ArrowUpRight className="h-3 w-3" /></Link></div>
            {upcoming.length === 0 ? (
              <p className="t-caption">Nothing planned yet. Passages you plan show up here with their risk.</p>
            ) : (
              <ul className="divide-y divide-border-soft">
                {upcoming.map((s) => {
                  const headline = s.conditions.length ? riskHeadline(s.conditions, [], s.waypoints, { utcOffsetMin: utcOffset, nowMs }) : 'Not checked yet.';
                  const departs = s.passage.actual_departure ?? s.passage.planned_departure;
                  return (
                    <li key={s.passage.id}>
                      <Link to={`/passages/${s.passage.id}`} className="flex items-start gap-3 py-2.5 -mx-1 px-1 rounded-lg hover:bg-bg-elev">
                        <RiskDot flag={s.worst} className="mt-1.5" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2"><span className="font-medium truncate">{s.passage.name}</span><span className="t-caption shrink-0">{s.passage.status === 'active' ? 'Underway' : whenPhrase(departs, utcOffset, nowMs, 'relative')}</span></span>
                          <span className="block t-caption line-clamp-2">{headline}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <DisclaimerBar />
      <div className="flex-1 min-h-0 flex relative">
        <div className="relative flex-1 min-w-0 min-h-0 overflow-hidden">
          <MapContainer center={[start.lat, start.lon]} zoom={start.zoom} className="h-full w-full" zoomControl attributionControl={false} preferCanvas>
            <AttributionControl position="topright" prefix={false} />
            <BaseTiles />
            <OpenSeaMapLayer visible={prefs.show_openseamap} />
            {field !== 'rain' || !wb.radarOn ? <ColourField grid={scalarGrid} kind={field} /> : null}
            <WindParticles grid={vectorGrid} enabled={particles} />
            {wb.radarOn && wb.radar && <RadarTiles host={wb.radar.host} frame={wb.radarFrames[wb.radarIdx] ?? null} />}
            <RouteLine points={draft.withEta.map((w) => ({ lat: w.lat, lon: w.lon }))} />
            {draft.withEta.map((w) => (
              <WaypointMarker key={w.key} lat={w.lat} lon={w.lon} sequence={w.sequence} name={w.name} isAnchorage={w.is_anchorage} selected={w.key === draft.selectedKey} draggable={planning && !saved}
                onDrag={(lat, lon) => draft.movePin(w.key, lat, lon)} onClick={() => { draft.setSelectedKey(w.key); if (planning) draft.setSheetKey(w.key); }} />
            ))}
            {inspect?.pinned && <CircleMarker center={[inspect.lat, inspect.lon]} radius={5} pathOptions={{ color: '#E6EDF7', weight: 1.5, fillColor: '#2DD4BF', fillOpacity: 0.9 }} />}
            {inspect?.pinned && !mobile && <PinTracker lat={inspect.lat} lon={inspect.lon} onMove={onPinMove} />}
            <ViewSync onView={wb.setView} />
            <GeoLocate enabled={!initial} />
            <Pointer planning={planning && !saved} onHover={wb.hover} onSettle={wb.settle} onLeave={wb.clearHover} onPlanClick={draft.addPin} />
          </MapContainer>

          {/* Top left, under the zoom control: map options. */}
          <div className={cn('absolute left-2.5 z-[1000]', mobile ? 'top-[88px]' : 'top-[92px]')}>
            <MapOptions model={wb.model} setModel={wb.setModel} run={run} particles={particles} setParticles={wb.setParticles} openSeaMap={prefs.show_openseamap} setOpenSeaMap={(v) => update({ show_openseamap: v })} />
          </div>

          {/* Top right: the rail toggle (desktop). */}
          {!mobile && (
            <div className="absolute right-2 top-9 z-[1000]">
              <button type="button" onClick={() => setRailOpen(!open)} aria-label={open ? 'Hide panel' : 'Show panel'} aria-expanded={open} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-soft bg-bg-1/95 backdrop-blur-sm text-text-2 shadow-card hover:text-text-1">{open ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}</button>
            </div>
          )}

          {planning && !saved && (
            <div className={cn('absolute z-[1000] rounded-lg border border-accent/40 bg-bg-1/95 backdrop-blur-sm px-3 py-2 text-[12px] text-text-1 flex items-center gap-2 shadow-card', mobile ? 'left-2 right-2 top-[136px]' : 'left-1/2 -translate-x-1/2 top-2')}><MapPin className="h-3.5 w-3.5 text-accent shrink-0" /> Planning: tap the map to drop a pin, drag to move{draft.withEta.length >= 2 && draft.preview && <span className="num text-text-2">· {draft.preview.totalDistanceNm.toFixed(1)} nm</span>}</div>
          )}

          {/* Bottom: radar bar, layer bar, legend, time bar. */}
          {wb.radarOn && (
            <div className={cn('absolute z-[1000] left-2 right-2', mobile ? 'bottom-[122px]' : 'bottom-[132px] md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[560px]')}>
              <RadarBar frames={wb.radarFrames} idx={wb.radarIdx} onChange={wb.setRadarFrame} error={wb.radarError} utcOffsetMin={utcOffset} />
            </div>
          )}
          <div className={cn('absolute z-[1000]', mobile ? 'left-2 right-2 bottom-[74px]' : 'left-1/2 -translate-x-1/2 bottom-[84px]')}>
            <LayerBar field={field} setField={wb.setField} setParticles={wb.setParticles} radarOn={wb.radarOn} setRadarOn={wb.setRadarOn} compact={mobile} />
          </div>
          {!mobile && (
            <div className="absolute right-2 top-[84px] z-[1000] pointer-events-none">
              <FieldLegend kind={field} className="pointer-events-auto" />
            </div>
          )}
          <div className="absolute left-2 right-2 bottom-2 z-[1000]">
            <TimeScrubber times={wb.times} index={wb.timeIndex} onChange={wb.setTimeIndex} marks={marks} utcOffsetMin={utcOffset} compact={mobile} caption={caption} loading={wb.loading} error={wb.error} />
          </div>

          {inspect && cardXY && (
            <PointCard lat={inspect.lat} lon={inspect.lon} pinned={inspect.pinned} x={cardXY.x} y={cardXY.y} mobile={mobile} timeIso={timeIso} run={run} leadHours={leadHours}
              point={wb.point} pointLoading={wb.pointLoading} gridValues={gridValues} onClose={wb.unpin} onPin={() => wb.settle(inspect.lat, inspect.lon, true, cardXY.x, cardXY.y)} utcOffsetMin={utcOffset} />
          )}

          {/* Mobile: the floating button that brings the sheet back. */}
          {mobile && !open && (
            <button type="button" onClick={openRail} className="absolute right-2 bottom-[124px] z-[1100] inline-flex h-10 items-center gap-2 rounded-full border border-border-soft bg-bg-1/95 backdrop-blur-sm px-4 text-[13px] font-medium text-text-1 shadow-card"><Route className="h-4 w-4 text-accent" /> {planning ? 'Passage panel' : 'Plan a passage'}</button>
          )}
        </div>

        {/* Right rail (desktop) */}
        {!mobile && open && (
          <aside className="w-[400px] shrink-0 border-l border-border-soft bg-bg-0 flex flex-col min-h-0 overflow-y-auto">{rail}</aside>
        )}
      </div>

      {/* Mobile bottom sheet */}
      {mobile && open && (
        <div className="fixed inset-x-0 bottom-0 z-[1200] max-h-[76vh] rounded-t-2xl border-t border-border-soft bg-bg-0 shadow-pop flex flex-col">
          <div className="flex items-center justify-between px-3 pt-2 pb-1"><span className="mx-auto h-1 w-10 rounded-full bg-border" aria-hidden /><button type="button" onClick={() => setRailOpen(false)} aria-label="Close panel" className="absolute right-2 top-1.5 inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-3 hover:text-text-1"><X className="h-4 w-4" /></button></div>
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">{rail}</div>
        </div>
      )}
    </div>
  );
}
