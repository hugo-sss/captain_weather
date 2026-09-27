// Conditions along the selected leg: the leg profile chart, then six plain stats (Simple) or the full
// field-card grid with provenance (Detailed), then the wind band chart over time (Detailed only).
import { Info } from 'lucide-react';
import type { DetailLevel, IngestTargetRow, VesselRow, WaypointConditionsRow, WaypointRow } from '@/types/domain.ts';
import { num } from '@/types/domain.ts';
import type { LegProfileData } from '@/lib/leg-profile.ts';
import { asSquall, etaDeltaMinutes, fmtEtaDelta } from '@/lib/leg-profile.ts';
import type { BandPoint } from '@/hooks/useBandSeries.ts';
import { compassWord, currentPhrase, localDayTime, sourceName, squallPhrase, utcStamp, windPhrase } from '@/lib/plain.ts';
import { fmtNum } from '@/lib/units.ts';
import { fmtUtc } from '@/lib/time.ts';
import { ukcBasisText } from '@/lib/gebco.ts';
import { gustSourceChip } from '@/lib/gust-source.ts';
import { Section } from '@/components/ui/section.tsx';
import { Segmented } from '@/components/ui/segmented.tsx';
import { Select } from '@/components/ui/select.tsx';
import { Stat } from '@/components/ui/stat.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { LegProfile } from '@/components/dashboard/LegProfile.tsx';
import { BandChart } from '@/components/dashboard/BandChart.tsx';
import { FieldCard } from '@/components/dashboard/FieldCard.tsx';
import { GustSourceChip } from '@/components/dashboard/GustSourceChip.tsx';
import { DepthSourceChip } from '@/components/dashboard/DepthSourceChip.tsx';
import { SquallBadge } from '@/components/dashboard/SquallBadge.tsx';
import { DisagreementBadge } from '@/components/dashboard/DisagreementBadge.tsx';
import { RISK_HEX } from '@/lib/risk-colors.ts';

type Props = {
  waypoints: WaypointRow[]; legs: LegProfileData[]; selected: WaypointRow | null; selC: WaypointConditionsRow | null; selLeg: LegProfileData | null;
  onSelect: (wpId: string) => void; vessel: VesselRow | null; utcOffsetMin: number | null; detail: DetailLevel;
  band: { points: BandPoint[]; target: IngestTargetRow | null; comparisonSource: string };
};

const LEGEND = [
  { label: 'Likely wind', swatch: '#2DD4BF', note: 'line: median, band: 10th to 90th percentile' },
  { label: 'Gusts', swatch: '#9AA8C0', dashed: true },
  { label: 'Sea', swatch: '#9AA8C0' },
  { label: 'Current', swatch: '#E6EDF7' },
];

export function ConditionsSection({ waypoints, selected, selC, selLeg, onSelect, vessel, utcOffsetMin, detail, band }: Props) {
  const maxWind = num(vessel?.max_wind_kn), maxWave = num(vessel?.max_wave_m);
  const legOptions = waypoints.slice(1).map((w, i) => ({ value: w.id, label: `Leg ${i + 1}`, title: `${waypoints[i]?.name ?? ''} to ${w.name ?? ''}` }));
  const fromName = selLeg?.from?.name ?? (selected ? waypoints[waypoints.findIndex((w) => w.id === selected.id) - 1]?.name : null) ?? null;
  const title = selected ? (fromName ? `${fromName} → ${selected.name ?? ''}` : selected.name ?? 'Selected waypoint') : 'Select a leg';
  const picker = legOptions.length > 0 && selected ? (
    <>
      {legOptions.length <= 5 && <span className="hidden md:inline-flex"><Segmented label="Leg" value={selected.id} onChange={onSelect} options={legOptions} size="sm" /></span>}
      <Select value={selected.id} onChange={(e) => onSelect(e.target.value)} aria-label="Leg" className={legOptions.length <= 5 ? 'md:hidden w-auto h-[30px] text-[13px]' : 'w-auto h-[30px] text-[13px]'}>
        {legOptions.map((o) => <option key={o.value} value={o.value}>{o.label}: {o.title}</option>)}
      </Select>
    </>
  ) : null;
  const dist = selLeg ? `${selLeg.distanceNm.toFixed(1)} nm` : null;
  const eta = selC?.eta ?? selected?.eta ?? null;
  const gustChip = gustSourceChip(selC?.gust_source);
  const etaDelta = etaDeltaMinutes(selC?.eta_planned, selC?.eta);
  const p50 = num(selC?.wind_p50_kn), p90 = num(selC?.wind_p90_kn), p10 = num(selC?.wind_p10_kn);
  const legMax = selLeg?.summary.maxWindP90 ?? null;
  const legMaxHs = selLeg?.summary.maxHs ?? null;
  const hs = num(selC?.wave_height_m), period = num(selC?.wave_period_s), swell = num(selC?.swell_height_m), swellDir = compassWord(num(selC?.swell_dir_deg));

  return (
    <Section id="conditions" title="Conditions along the selected leg" description={<span>{title}{dist ? ` · ${dist}` : ''}{eta ? ` · arriving ${localDayTime(eta, utcOffsetMin)} local` : ''}</span>} actions={picker}>
      <div className="card p-4 md:p-5 space-y-5">
        {selLeg ? (
          <div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-2">
              <span className="t-card">Along the leg</span>
              <div className="chart-legend">
                {LEGEND.map((l) => <span key={l.label} className="inline-flex items-center" title={l.note}><span className="swatch" style={l.dashed ? { background: 'transparent', borderTop: `2px dashed ${l.swatch}`, height: 0 } : { background: l.swatch }} />{l.label}</span>)}
                <Tooltip>
                  <TooltipTrigger asChild><button type="button" className="inline-flex h-5 w-5 items-center justify-center rounded-full text-text-3 hover:text-text-1" aria-label="How to read this chart"><Info className="h-3.5 w-3.5" /></button></TooltipTrigger>
                  <TooltipContent className="max-w-sm">The wind line is the median forecast, the shaded band runs from the 10th to the 90th percentile of the ensemble. Short ticks mark the high-end gust (dashed when estimated). The tint behind each stretch is its risk flag; hatching means no data. Bolts mark squall risk. Red lines are your limits. Hover a point for its numbers.</TooltipContent>
                </Tooltip>
              </div>
            </div>
            <LegProfile leg={selLeg} maxWindKn={maxWind} maxWaveM={maxWave} utcOffsetMin={utcOffsetMin} />
          </div>
        ) : (
          <div className="h-32 gap-hatch rounded-lg flex items-center justify-center text-center px-6 text-[13px] text-text-3">{selected ? 'No points sampled along this leg yet. The next check samples every leg about every 6 hours.' : 'Pick a leg above to see conditions along it.'}</div>
        )}

        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
            <span className="t-card">At {selected?.name ?? 'the waypoint'}</span>
            {eta && <span className="t-caption">arriving {localDayTime(eta, utcOffsetMin)} local{etaDelta !== null ? `, ${fmtEtaDelta(etaDelta)} for sea state` : ''}</span>}
            {selC?.source_disagreement && <DisagreementBadge active speedDelta={num(selC.wind_speed_delta_kn)} dirDelta={num(selC.wind_dir_delta_deg)} primary={selC.atmos_source} comparison={selC.comparison_source} size="sm" />}
          </div>
          {detail === 'simple' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-5 gap-y-4">
              <Stat label="Wind" value={selC ? windPhrase(selC.wind_p50_kn, selC.wind_p90_kn, selC.wind_dir_mean_deg, null) : null} reason="No wind data at this point" hint={<span>Likely (median) to high-end (90th percentile) of the forecast ensemble.{p50 !== null && <span className="block num text-text-2 mt-1">p10 {fmtNum(p10, 0)} · p50 {fmtNum(p50, 0)} · p90 {fmtNum(p90, 0)} kn</span>}</span>}
                sub={legMax !== null && p90 !== null && legMax > p90 + 1 ? `Up to ${Math.round(legMax)} kn mid-leg` : undefined} />
              <Stat label="Gusts" value={selC && num(selC.gust_p90_kn) !== null ? <span>{Math.round(num(selC.gust_p90_kn)!)} kn</span> : null} reason="No gust data" hint="High-end (90th percentile) gust from the ensemble." sub={gustChip?.estimated ? 'Estimated from the wind' : selLeg?.summary.maxGustP90 && num(selC?.gust_p90_kn) !== null && selLeg.summary.maxGustP90 > num(selC!.gust_p90_kn)! + 1 ? `Up to ${Math.round(selLeg.summary.maxGustP90)} kn mid-leg` : undefined} />
              <Stat label="Sea" value={hs !== null ? `${fmtNum(hs, 1)} m${period !== null ? ` at ${Math.round(period)} s` : ''}` : null} reason="No marine grid point within 55 km" hint="Significant wave height and peak period." sub={legMaxHs !== null && hs !== null && legMaxHs > hs + 0.2 ? `Up to ${fmtNum(legMaxHs, 1)} m mid-leg` : undefined} />
              <Stat label="Swell" value={swell !== null ? `${fmtNum(swell, 1)} m${swellDir ? ` from the ${swellDir}` : ''}` : null} reason="No marine data" />
              <Stat label="Current" value={selC ? currentPhrase(selC.current_speed_kn, selC.current_dir_deg) : null} reason="No current data (weak in straits)" hint="Speed and the direction the current sets toward." />
              <Stat label="Squall risk" value={selC ? squallPhrase(selC.squall_risk) : null} tone={selC?.squall_risk === 'likely' ? 'amber' : 'default'} reason="No atmospheric data" hint={<span>From convective energy and chance of rain.{selC && <span className="block num text-text-2 mt-1">CAPE {num(selC.cape_p50_jkg) === null ? 'unknown' : `${Math.round(num(selC.cape_p50_jkg)!)} J/kg`} · rain {num(selC.precip_prob_pct) === null ? 'unknown' : `${Math.round(num(selC.precip_prob_pct)!)} %`}</span>}</span>} />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                <FieldCard label="Wind p50 / p90" value={p50 !== null ? `${fmtNum(p50, 0)} / ${fmtNum(p90, 0)}` : null} unit="kn" sub={p10 !== null ? `p10 ${fmtNum(p10, 0)} kn · from ${Math.round(num(selC?.wind_dir_mean_deg) ?? 0)}°` : undefined} reason="no atmospheric data within 55 km or 6 h of the ETA" />
                <FieldCard label="Gust p90" value={num(selC?.gust_p90_kn)} unit="kn" aside={<GustSourceChip source={selC?.gust_source} />} reason="no atmospheric data" />
                <FieldCard label="Squall risk" value={selC ? squallPhrase(asSquall(selC.squall_risk)) : null} aside={<SquallBadge risk={selC?.squall_risk} capeJkg={num(selC?.cape_p50_jkg)} precipPct={num(selC?.precip_prob_pct)} size="sm" />} sub={selC ? `CAPE ${num(selC.cape_p50_jkg) === null ? 'unknown' : Math.round(num(selC.cape_p50_jkg)!) + ' J/kg'} · rain ${num(selC.precip_prob_pct) === null ? 'unknown' : Math.round(num(selC.precip_prob_pct)!) + ' %'}` : undefined} reason="no atmospheric data" />
                <FieldCard label="Wave / period" value={hs !== null ? `${fmtNum(hs, 1)} m / ${fmtNum(period, 0)} s` : null} reason="no marine grid point within 55 km" />
                <FieldCard label="Swell / direction" value={swell !== null ? `${fmtNum(swell, 1)} m / ${Math.round(num(selC?.swell_dir_deg) ?? 0)}°` : null} reason="no marine data" />
                <FieldCard label="Tide (station)" value={num(selC?.tide_height_m)} unit={`m ${selC?.tide_datum ?? ''}`} sub={selC?.tide_state ? `${selC.tide_state} · station ${selC.tide_station_id ?? 'unknown'}` : undefined} reason="no tidal data: station unresolved, or tide key not configured" />
                <FieldCard label="Current, sets toward" value={num(selC?.current_speed_kn) !== null ? `${fmtNum(num(selC?.current_speed_kn), 1)} kn → ${Math.round(num(selC?.current_dir_deg) ?? 0)}°` : null} reason="no marine data (currents are weak in straits)" />
                <FieldCard label="ETA, sea state" value={selC?.eta ? fmtUtc(selC.eta) : null} sub={selC?.eta_planned ? `planned ${fmtUtc(selC.eta_planned)}${etaDelta !== null ? ` · ${fmtEtaDelta(etaDelta)} sea state` : ' · no change'}${num(selC.speed_loss_pct) !== null ? ` · loss ${fmtNum(num(selC.speed_loss_pct), 0)} %` : ''}` : 'no planned-speed ETA in this run'} reason="no run" />
                <FieldCard label="Under-keel clearance" value={num(selC?.ukc_estimate_m)} unit="m" sub={ukcBasisText(selC?.ukc_basis, selected?.charted_depth_source)} aside={<DepthSourceChip source={selected?.charted_depth_source} />} reason="needs vessel draft, charted depth and tide" />
                <FieldCard label="Visibility p50" value={num(selC?.visibility_p50_m) !== null ? Math.round(num(selC?.visibility_p50_m)! / 100) / 10 : null} unit="km" reason="not carried by this model" />
                <FieldCard label="Pressure p50" value={num(selC?.mslp_p50_hpa)} unit="hPa" reason="no atmospheric data" />
                <FieldCard label="Chance of rain" value={num(selC?.precip_prob_pct)} unit="%" reason="no atmospheric data" />
                <FieldCard label="Comparison wind" value={num(selC?.comparison_wind_kn) !== null ? `${fmtNum(num(selC?.comparison_wind_kn), 0)} kn / ${Math.round(num(selC?.comparison_wind_dir_deg) ?? 0)}°` : null} sub={sourceName(selC?.comparison_source) ?? undefined} reason="no comparison row at this hour" />
                <FieldCard label={selected?.charted_depth_source === 'gebco' ? 'Depth (GEBCO grid)' : 'Charted depth'} value={num(selected?.charted_depth_m)} unit="m" aside={<DepthSourceChip source={selected?.charted_depth_source} />} sub={selected?.charted_depth_source === 'gebco' ? 'grid value, not a charted sounding' : selected?.charted_depth_source === 'user' ? 'entered by hand' : undefined} reason="enter it in Edit route, or accept a GEBCO grid suggestion there" />
                <FieldCard label="Lead time" value={num(selC?.lead_time_hours) !== null ? Math.round(num(selC?.lead_time_hours)!) : null} unit="h" sub={selC?.atmos_init_time ? `run ${utcStamp(selC.atmos_init_time)}` : undefined} reason="no run" />
              </div>
              {selC && (selC.risk_reasons as string[]).length > 0 && (
                <div className="mt-3 tile px-4 py-3">
                  <div className="label mb-1">Why this flag</div>
                  <ul className="text-[13px] space-y-0.5">{(selC.risk_reasons as string[]).map((r) => <li key={r} className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 rounded-full shrink-0" style={{ background: RISK_HEX[selC.risk_flag as keyof typeof RISK_HEX] ?? RISK_HEX.unknown }} /><span className="num text-text-2">{r}</span></li>)}</ul>
                </div>
              )}
              <div className="mt-5">
                <div className="t-card mb-2">Wind at the waypoint over time</div>
                <BandChart bare points={band.points} limitKn={maxWind} etaIso={eta} comparisonLabel={sourceName(band.comparisonSource) ?? band.comparisonSource} meta={band.target ? `grid point ${Number(band.target.grid_lat).toFixed(2)}, ${Number(band.target.grid_lon).toFixed(2)}` : undefined} />
              </div>
            </>
          )}
        </div>
      </div>
    </Section>
  );
}
