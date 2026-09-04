> Source of truth: `brain/projects/captain-passage-tool/prd.md` in the sss-wiki repo (PR #21). This is a verbatim copy seeded 2026-09-04 with wikilinks rewritten.

# Captain Passage Tool: Master PRD v5 (build-ready)

Parent: [_index](https://github.com/superyachtsundayschool/wiki/blob/main/brain/projects/captain-passage-tool/_index.md)
Protocol: [second-brain](https://github.com/superyachtsundayschool/wiki/blob/main/brain/second-brain.md)
Companion files: [schema.sql](schema.sql) (migration 0001), [build-prompt](build-prompt.md) (Claude Code session opener)

This is the architect-phase output of Hugo's Master PRD v4. It keeps every requirement of v4, resolves the open contradictions, verifies the external data sources against their published docs, and adds the specs a builder needs that v4 left implicit: the passage engine, the conditions join, the confidence rules as code, the design system, the repo layout. A Claude Code session should be able to build Phase 1 from this document plus `schema.sql` without asking Hugo a question.

Personal project. Not SSS-operational. No AKM classification.

---

## 1. Overview

**Working name:** Captain Passage Tool (app name still open, see §15).

**The problem.** Weather tools (PredictWind, Windy) show dense model data with no passage-plan awareness and no honest uncertainty. ECDIS planners (Transas Navi-Planner and similar) handle routes and charts with no weather layer. Neither tells a captain, in plain language, what conditions will be at each waypoint at the time they arrive, with tide, current and depth in the same view. Every anchor app on the market (Ankr, PredictWind Anchor Alert, Anchor Pro, SailGrib AA) is reactive: drag alarms after the hook is down. None predict whether an anchorage will be tenable before you get there.

**The solution.** A personal web app that ingests a real passage plan (map pins, GPX, CSV), computes per-waypoint ETAs, joins those ETAs against three independent forecast layers (atmospheric ensemble, marine sea state, tide and current), and shows both a data-dense professional table and an AI-narrated plain-English briefing. Any waypoint can be an anchorage with a stay window, producing a predictive stay-window summary. Chart overlays add navigational context. A second, independent atmospheric model runs alongside the primary one and disagreement is flagged out loud.

**Target user v1:** Hugo, as a working yacht captain. Genuine usefulness over polish. Architecture stays modular (adapters, settings table, RLS) so a multi-user v2 is configuration, not a rebuild.

**Target user v2+ (deferred):** professional and recreational skippers. Gated on licensing (§14).

**Core philosophy: trust, then verify.** Captains are trained to distrust black boxes and to cross-check forecasts. That is professional norm, not paranoia (§8.1). The product never asks for blind trust. The default landing view is the raw professional table with two model sources side by side. The AI briefing is an interpretive layer on top. As a captain demonstrates reliance on the tool over time, the UI may de-emphasise raw tables in favour of the narrative, but that is a display preference and never a data-access restriction. Raw data stays one tap away at all times.

---

## 2. Decisions made in this architect pass

v4 said "treat as final, don't ask". These are the calls made so the builder does not have to, each with the reason.

| # | Decision | Why |
|---|---|---|
| 1 | **Claude Code builds it.** Stack stays React + Vite + Tailwind + shadcn so a Lovable import remains possible later. | v4 §2 said Lovable, the instruction said Claude Code. One builder, one prompt (`build-prompt.md`). |
| 2 | **Atmospheric v1 = WeatherNext 2 ensemble + ECMWF IFS ensemble via Open-Meteo. WeatherNext 3 via BigQuery is a v2 adapter swap.** | Verified: Open-Meteo's ensemble endpoint serves `google_weathernext2_ensemble` (64 members) and `ecmwf_ifs025_ensemble` (51 members) with per-member hourly values. Percentiles are computed in our adapter. WeatherNext 3 needs Google's data-request allowlist, BigQuery billing on a multi-TB table, service-account JWT signing from Deno, and sits under experimental real-time terms. That is the single biggest risk to the MVP ever working, so it moves behind the adapter contract. Hugo's intent (DeepMind ensemble percentiles) is kept. |
| 3 | **Comparison layer = deterministic GFS (`ncep_gfs_global`) via Open-Meteo, with the ECMWF ensemble median as a second independent model.** `forecast_comparison` is a view over one atmospheric cache table, not a second table. | Resolves v4 open decision #6. Caveat recorded: the models are independent, the delivery pipe is shared. NOAA NOMADS GRIB is the true second-pipe option for v2. |
| 4 | **Tides = TidesAtlas (verified REST API, `X-API-Key`, credit-based, 17k+ stations incl. SE Asia). Currents = Open-Meteo Marine SMOC only.** WorldTides is the named backup. | No TidesAtlas currents endpoint was found. SMOC is 8 km and weak inside straits; the UI says so. Open-Meteo's `sea_level_height_msl` is a model surface height, not tide above chart datum, and is never displayed as tide. |
| 5 | **Demand-driven, asynchronous ingestion.** Cron every 15 min kicks one edge function per layer; the function returns at once and processes one batch of due `ingest_targets` in `EdgeRuntime.waitUntil()`. Targets exist only around passages that are planned or active. Nightly purge by `init_time`. | Verified limits: edge function wall clock 150 s free / 400 s paid; pg_net is fire-and-forget with a 5 s cap. Global ingestion would blow both the timeouts and the 10,000 calls/day free tier. |
| 6 | **Confidence governance is code, not prompt.** Triggers are computed by rules before the model call and injected as a hard constraint. A banned-phrase validator runs on the output; one retry, then fail closed. | v4 §13.3 asked for rule-governed confidence. A prompt instruction alone cannot guarantee it. |
| 7 | **Draft added to vessels; UKC estimate on every waypoint row with a stated basis.** | v4 §13.6 wanted tide and swell paired for under-keel clearance but the schema had no draft to compute it from. |
| 8 | **Every conditions join is a run.** Re-checks reference the run they supersede; each row stores the ETA and forecast init time actually used. | Feature 12's "material change" diff needs run N vs run N-1, and must separate "ETA moved" from "forecast changed". |
| 9 | **PostGIS from day one.** Geography points on waypoints, targets and chart features; nearest-grid join uses the `<->` operator on a GiST index. Caches are keyed on target id, never on floating lat/lon. | Numeric lat/lon uniqueness breaks on float drift; the antimeridian breaks bbox maths. |
| 10 | **Wind direction is stored as circular mean and spread.** No p10/p50/p90 on direction. | Percentiles of a circular quantity are meaningless (350° and 10° have a "median" of 180°). |
| 11 | **RLS on from day one**, owner-scoped. Caches readable by any signed-in user, written only by the service role. | Makes the v2 multi-user pivot a config change, as v4 promised. |
| 12 | **Own Supabase project.** Not CV-AI-Review, not SSS_Brain. | Same ruling as Detour: personal apps get their own project. Nothing in this PRD touches a live SSS database. |
| 13 | **Mapping stack fixed:** react-leaflet + leaflet-geoman-free for pins and drags, route as a `<Polyline>` from app state, `@tmcw/togeojson` for GPX, `@dnd-kit/sortable` for the waypoint list. | leaflet-routing-machine is road routing; unsuitable. |
| 14 | **Briefing model = `claude-opus-5` via the official TypeScript SDK, structured JSON output, adaptive thinking, effort `medium`, server-side refusal fallback enabled.** Model id lives in an env var. | One briefing is roughly 6k input tokens and 1.5k output tokens, about seven US cents at $5/$25 per million. Volume is a few a day. Quality of the narrative matters more than the cents. |
| 15 | **Design system authored for dark from the start** (tokens in §9). Saturated colour is reserved for risk and disagreement; everything else is desaturated. | Windy has publicly said its own dark mode is limited because its colour scales were designed for light backgrounds. Do not repeat that. |

---

## 3. Tech stack and plumbing

| Layer | Choice | Notes |
|---|---|---|
| Builder | Claude Code | Session opener in `build-prompt.md` |
| Front end | React 18 + Vite + TypeScript, Tailwind, shadcn/ui | Lovable-compatible stack |
| Map | react-leaflet, OpenStreetMap base tiles, OpenSeaMap overlay tiles, NOAA ENC GeoJSON overlay (US only) | leaflet-geoman-free for editing |
| Database + auth | Supabase (Postgres 15+, PostGIS, RLS). Single user via email magic link in v1 | Own project, see §2 #12 |
| Scheduling | `pg_cron` + `pg_net` defined in SQL migrations | §11 |
| Ingestion + compute | Supabase Edge Functions (Deno, TypeScript) | One function per concern, shared adapters |
| Briefing | Edge Function `generate-briefing` calling Claude via `@anthropic-ai/sdk` | §8.5 |
| Payments | None in v1 | |

Environment variables for edge functions: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `TIDESATLAS_API_KEY`, `ANTHROPIC_API_KEY`, `BRIEFING_MODEL` (default `claude-opus-5`), `BRIEFING_PROMPT_VERSION`. No secrets in the repo, ever.

---

## 4. Features and acceptance criteria

### Feature 1: Passage input (three methods, one data model)
- Map pin-drop, GPX import, CSV import (`name,lat,lon[,is_anchorage,stay_hours]`) all write to `waypoints`.
- Pins draggable; waypoint list reorderable by drag; sequence renumbers on the client and saves in one transaction (the unique constraint is deferred for this reason).
- GPX: read `<rte>`/`<rtept>` first, fall back to `<trk>` with a "track imported, consider simplifying" notice. Waypoints beyond 200 prompt a Douglas-Peucker simplification.
- **Done when:** the same 5-waypoint passage imported three ways produces identical rows apart from `source`.

### Feature 2: Passage engine (ETA computation)
Spec in §6. **Done when:** a 3-leg test passage at 9 kn produces ETAs matching a hand calculation within one minute, and changing one leg's `planned_speed_kn` shifts only downstream ETAs.

### Feature 3: Multi-source forecast ingestion
Adapters in §5, scheduling in §11. **Done when:** a planned passage produces `ingest_targets` for all four layers within one cron tick and the forecast tables fill for the passage's ETA range without any manual step.

### Feature 4: Waypoint conditions join
Spec in §7. **Done when:** every waypoint of a planned passage has a `waypoint_conditions` row with a `risk_flag`, a `confidence_level`, a `confidence_triggers` list, and (where marine and tidal targets exist) wave and tide values, produced by one run.

### Feature 5: AI briefing generation with confidence governance
Spec in §8. **Done when:** the briefing for a passage with a waypoint more than five days out states reduced confidence in plain words, never contains a banned phrase, and always ends with the SOLAS V/34 standing statement.

### Feature 6: Dual-mode dashboard, raw data first
- **Professional mode** is the default landing view: KPI strip, per-leg table, percentile bands, tide and current columns, risk colour, disagreement marker, GPX export.
- **Simplified mode:** map first, briefing as hero card. One tap back to the table.
- **Comparison view:** primary ensemble vs comparison model side by side per leg with deltas and flags (Feature 11).
- **Done when:** a display preference `narrative_emphasis` (0..1) exists, changes only ordering and emphasis, and no data becomes unreachable at any value.

### Feature 7: Nautical chart overlay (view-only)
- OpenSeaMap tile overlay labelled "crowdsourced, not official".
- NOAA ENC overlay from pre-processed GeoJSON (§5.6), US waters only.
- Persistent, non-dismissible disclaimer on any screen with a chart overlay: "Supplementary planning aid. Not a certified ECDIS or a substitute for official charts."
- **Done when:** both overlays toggle independently and the disclaimer cannot be hidden.

### Feature 8: Hazard-aware passage engine (v2, specced not built)
`chart_features` and `waypoint_conditions.hazard_flags` are reserved. v2 spatial-joins each leg against DEPARE/OBSTRN/WRECKS geometry. Nothing built in v1.

### Feature 9: Vessel profiles
Cruise speed, draft, thresholds (`max_wind_kn`, `max_gust_kn`, `max_wave_m`, `max_current_kn`, `min_ukc_m`), optional polars. **Done when:** editing `max_wave_m` and re-running conditions changes `risk_flag` on the affected legs and nothing else.

### Feature 10: Anchorage prediction (basic)
- A waypoint with `is_anchorage = true` and `planned_departure_from_here` defines a stay window.
- `anchorage_conditions` summarises the window: median and worst-case wind, gust, predominant direction and how far it veers, max wave and swell with direction, tide min/max/range, minimum UKC estimate.
- Manual `anchorage_exposure_tag` (sheltered / partial / exposed) in v1. Shelter geometry and seabed type are v2.
- **Anchorage stay view pairs tide height and swell height on one time axis** (v4 §13.6).
- **Done when:** a 14-hour stay produces a row whose `wind_max_p90_kn` equals the max of the hourly p90 values in the window.

### Feature 11: Multi-source comparison and disagreement flagging
- Compute `wind_speed_delta_kn` and `wind_dir_delta_deg` between the primary ensemble median and the comparison model at each waypoint's forecast hour (the `forecast_comparison` view).
- Set `source_disagreement` when speed delta exceeds `disagreement_thresholds.wind_speed_kn` (5) or direction delta exceeds `disagreement_thresholds.wind_dir_deg` (15) **and** the primary p50 is at least 8 kn (direction is noise in light air).
- Surface it as a visible marker in the Professional table, a column in the comparison view, and a sentence in the briefing ("WeatherNext and GFS diverge on wind direction for leg 3. Cross-check before relying on either.").
- **Done when:** a fixture with a 20° divergence flags, a 10° divergence does not, and a 20° divergence at 5 kn does not.

### Feature 12: In-passage re-check
- "Re-check conditions" on an active passage creates a `conditions_runs` row of kind `recheck` pointing at the previous run, re-anchors ETAs from the last arrived waypoint (§6.4), re-joins remaining waypoints, and regenerates a briefing with `scope = 'remaining'`.
- Material change = any of: `risk_flag` worsened, `source_disagreement` newly true, `confidence_level` dropped, wind p90 moved by more than 5 kn, wave moved by more than 0.5 m, tide at an anchorage moved by more than 0.3 m. Changes are listed in `passage_briefings.material_changes` and shown as a banner before any numbers.
- v1 is manual trigger only. Scheduled re-checks are v2.
- **Done when:** a re-check with unchanged forecasts produces an empty `material_changes` list, and a fixture that raises one leg's wind above the vessel limit produces exactly one entry.

---

## 5. Data sources, adapter contracts, licensing

Every external source sits behind one adapter in `supabase/functions/_shared/adapters/`. An adapter takes an `IngestTarget` plus a time range and returns rows in the cache-table shape. Swapping a provider touches one file.

| Layer | v1 primary | v1 secondary | v2 | Verified against |
|---|---|---|---|---|
| Atmospheric ensemble | Open-Meteo Ensemble, `google_weathernext2_ensemble` (64 members) | Open-Meteo Ensemble, `ecmwf_ifs025_ensemble` (51 members) | WeatherNext 3 via BigQuery | open-meteo `openapi/ensemble.yml` |
| Comparison (deterministic) | Open-Meteo Forecast, `ncep_gfs_global` | ECMWF ensemble median (above) | NOAA NOMADS GRIB (true second pipe) | open-meteo docs source |
| Marine sea state + currents | Open-Meteo Marine (`meteofrance_wave` for waves, `meteofrance_currents` SMOC for currents) | `ecmwf_wam025` as a wave cross-check | HYCOM currents | open-meteo marine options |
| Tides | TidesAtlas REST | WorldTides | UKHO Admiralty (UK/IE only, not useful for SE Asia) | search snippets of official pages: **re-check at build time** |
| Chart context | OpenSeaMap tiles (global, crowdsourced) | NOAA ENC S-57 → GeoJSON (US only) | purchased ENCs | NOAA + GDAL docs: **re-check at build time** |

### 5.1 Atmospheric adapter (`openMeteoEnsemble.ts`)
- Endpoint: `https://ensemble-api.open-meteo.com/v1/ensemble`
- Params: `latitude`, `longitude`, `models=google_weathernext2_ensemble` (one model per call), `hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,pressure_msl,cape,visibility,temperature_2m`, `wind_speed_unit=kn`, `forecast_days=10`, `timezone=UTC`.
- Response members: control is the bare name (`wind_speed_10m`), perturbed members are `wind_speed_10m_member01` … `_memberNN`.
- Adapter computes per hour: p10/p50/p90 of speed and gust, circular mean and circular std dev of direction, precipitation probability as the share of members above 0.1 mm, p50 of the rest. Stores raw speed and direction members for the newest init only.
- `init_time` comes from the response metadata; if absent, floor `now()` to the model's cycle (ECMWF ENS 00/06/12/18, WeatherNext hourly).
- Caveat carried from the docs: ECMWF ensembles are limited to 00z and 06z runs with a smaller variable set.

### 5.2 Comparison adapter (`openMeteoGfs.ts`)
- Endpoint: `https://api.open-meteo.com/v1/forecast`, `models=ncep_gfs_global`, same hourly list minus `cape` (not hourly on GFS), `wind_speed_unit=kn`.
- Writes rows with `kind='deterministic'`, `member_count=1`, p10 = p50 = p90 = value, `wind_dir_spread_deg = 0`.

### 5.3 Marine adapter (`openMeteoMarine.ts`)
- Endpoint: `https://marine-api.open-meteo.com/v1/marine`
- Hourly: `wave_height,wave_direction,wave_period,wind_wave_height,swell_wave_height,swell_wave_direction,swell_wave_period,sea_level_height_msl,ocean_current_velocity,ocean_current_direction,sea_surface_temperature`, `forecast_days=8`.
- Current velocity arrives in km/h unless `current_velocity_unit=kn` is available; convert in the adapter, never in the UI.
- `ocean_current_direction` is the direction the current flows **toward**. Store as-is, label in the UI as "sets toward".

### 5.4 Tidal adapter (`tidesAtlas.ts`)
- Base `https://tidesatlas.com/api/v1`, header `X-API-Key`. Resolve nearest station once per target (store `station_id`, `station_distance_km`), then fetch predictions for the target's horizon. Store `datum` from the response; default `CD`, mark `unknown` if not stated.
- Derive `tide_state` from the height series (rising = flood, falling = ebb, turning points = high/low, within ±10% of range of a turning point = slack).
- Budget: credit-based. One fetch per station per day is enough; predictions are harmonic.
- Fallback adapter `worldTides.ts` with the same output shape.

### 5.5 Chart adapter (offline preprocessing, not an edge function)
- Script `scripts/enc-to-geojson.sh`: download S-57 cells from `charts.noaa.gov/ENCs`, run `ogr2ogr -f GeoJSON` with the GDAL S57 driver (`SPLIT_MULTIPOINT=ON`, `UPDATES=APPLY`), keep DEPARE, DEPCNT, SOUNDG, OBSTRN, WRECKS, LIGHTS, load into `chart_features`.
- Runs on Hugo's Mac when needed. Not scheduled.

### 5.6 Licence posture carried verbatim
- Open-Meteo: free tier is non-commercial only (apps without subscriptions or advertising qualify), 600 calls/min, 5,000/hour, 10,000/day; data CC-BY 4.0; attribution to Open-Meteo required in the UI.
- WeatherNext (Google DeepMind): data older than 48 h is CC-BY 4.0; real-time data is under the "GDM Real-Time Weather Forecasting Experimental Data Terms of Use" with an "as-is, does not constitute official forecasts, watches or warnings" disclaimer. Personal single-user use is the deliberate v1 posture.
- TidesAtlas, WorldTides, OpenSeaMap: verify commercial terms before any v2.
- NOAA ENC: US public domain, "not certified for navigation" when served as GIS layers.

---

## 6. Passage engine spec (NEW)

Pure TypeScript module `src/lib/passage-engine/`, no I/O, unit-tested. Also compiled into the `compute-conditions` edge function via `_shared`.

### 6.1 Inputs
```ts
type EngineInput = {
  departure: string;                 // ISO, passage.actual_departure ?? planned_departure
  cruiseSpeedKn: number;             // vessel.cruise_speed_kn
  useCurrent: boolean;               // display preference, default false in v1
  waypoints: Array<{
    id: string; sequence: number; lat: number; lon: number;
    plannedSpeedKn?: number; isAnchorage: boolean; departureFromHere?: string;
    arrived: boolean; arrivedAt?: string;
  }>;
  currentAt?: (lat: number, lon: number, iso: string) => { speedKn: number; dirTowardDeg: number } | null;
};
```

### 6.2 Rules
1. Sort by `sequence`. Leg *i* runs from waypoint *i-1* to waypoint *i*.
2. `leg_distance_nm` = great-circle (haversine) distance with R = 3440.065 nm. Rhumb-line option is v2.
3. `leg_bearing_deg` = initial great-circle bearing, normalised 0..360.
4. Speed through water for leg *i* = `waypoints[i].plannedSpeedKn ?? cruiseSpeedKn`. Must be > 0 or the engine returns an error for that leg.
5. If `useCurrent` and `currentAt` returns data at the leg midpoint at the first-pass ETA: speed over ground = STW + current speed × cos(current direction − leg bearing), clamped to a minimum of 1 kn. One refinement pass only.
6. `eta[0]` = departure. For *i* > 0: `eta[i]` = `departFrom[i-1]` + distance / SOG.
7. `departFrom[i]` = `departureFromHere` if the waypoint is an anchorage, else `eta[i]`. If an anchorage's `departureFromHere` is earlier than its ETA, the engine flags `stay_window_invalid` and uses the ETA.
8. Total passage time, total distance, and per-leg hours are returned for the KPI strip.

### 6.3 Output
```ts
type EngineOutput = {
  legs: Array<{ waypointId: string; distanceNm: number; bearingDeg: number; stwKn: number; sogKn: number; hours: number; eta: string; departFrom: string; warnings: string[] }>;
  totalDistanceNm: number; totalHours: number; arrival: string;
};
```

### 6.4 Re-anchoring for re-checks (Feature 12)
If any waypoint has `arrived = true`, the engine starts from the last arrived waypoint with `departure = arrivedAt` and only returns legs after it. If the UI passes a current position (optional in v1), a synthetic leg from that position to the next waypoint is prepended.

---

## 7. Waypoint conditions join spec (NEW)

Edge function `compute-conditions`, invoked by the UI with `{ passage_id, kind: 'initial' | 'recheck' }`. Runs inside one `conditions_runs` row.

1. Load passage, vessel, waypoints. Run the engine (§6) and persist `eta`, `leg_distance_nm`, `leg_bearing_deg` back to `waypoints`.
2. For each remaining waypoint and each layer, find `nearest_target(layer, geom)`. If the nearest target is farther than 2 × `ingest_grid.spacing_deg` (about 55 km at 0.25°), treat that layer as a data gap for this waypoint and add the trigger `no_data_<layer>`.
3. Pick the forecast row: newest `init_time` for the configured source, then the `forecast_time` nearest the ETA. If the nearest hour is more than 90 min away, linearly interpolate between the two bracketing hours (circular interpolation for direction). If no bracketing rows exist, data gap.
4. Copy the values into `waypoint_conditions` with `atmos_init_time`, `atmos_forecast_time`, `marine_init_time`, and `lead_time_hours = eta − atmos_init_time`.
5. Comparison: read `forecast_comparison` for the same target and forecast hour. Apply the Feature 11 rule. Store deltas and `disagreement_detail` (`{primary: {...}, comparison: {...}, thresholds: {...}}`).
6. UKC estimate (only when `vessel.draft_m` is set):
   - `charted+tide+swell` when `charted_depth_m` and `tide_height_m` and `swell_height_m` are all present: `ukc = charted_depth + tide_height − draft − swell_height / 2 − squat`, where squat = 0.3 m underway, 0 at an anchorage.
   - `charted+tide` when swell is missing (squat still applied).
   - `none` otherwise; `ukc_estimate_m` null.
7. Risk flag against vessel thresholds (`risk_defaults.amber_fraction_of_limit` = 0.75):
   - `red` if any of: `wind_p50_kn > max_wind_kn`, `gust_p90_kn > max_gust_kn`, `wave_height_m > max_wave_m`, `current_speed_kn > max_current_kn`, `ukc_estimate_m < min_ukc_m`.
   - `amber` if none are red and any of: `wind_p90_kn > 0.75 × max_wind_kn`, `gust_p90_kn > 0.75 × max_gust_kn`, `wave_height_m > 0.75 × max_wave_m`, `source_disagreement` is true, `ukc_estimate_m < 1.5 × min_ukc_m`.
   - `unknown` if the atmospheric layer is a data gap.
   - `green` otherwise. Every rule that fires is written to `risk_reasons` in words.
   - A missing vessel threshold skips that rule; it never defaults to a guess.
8. Confidence (§8.2) computed and stored.
9. Anchorage waypoints additionally get an `anchorage_conditions` row aggregated over every forecast hour in `[eta, planned_departure_from_here]` per Feature 10.
10. Mark the run `complete` with `sources_used`. On any thrown error, mark `failed` with the message; never leave a run `running`.

---

## 8. Trust, confidence governance, and language rules

### 8.1 Why captains will not trust this by default
Professional training teaches independent verification of forecasts. Published verification of NWP/GRIB winds against ship observations shows average direction errors around ±35° and speed errors around ±3.3 kn, worse near coasts, headlands and complex terrain. This is a property of the whole category, not of any one model. The product is designed for that scepticism rather than against it.

### 8.2 Confidence triggers (computed, never model-judged)

| Trigger id | v1 computation | Effect on level |
|---|---|---|
| `lead_time_gt_120h` | `lead_time_hours > 120` | forces `low` (MCA guidance: forecasts are rarely reliable beyond 5 days) |
| `lead_time_72_120h` | `72 < lead_time_hours ≤ 120` | caps at `moderate` |
| `tropical_activity` | `passages.tropical_activity_flag` (manual in v1; NHC/JTWC feed in v2) | forces `low` |
| `frontal_activity` | `passages.frontal_activity_flag` (manual in v1; pressure-tendency heuristic in v2) | forces `low` |
| `complex_coastal` | `waypoints.is_complex_coastal` (manual in v1; coastline-distance heuristic in v2) | caps at `moderate` |
| `source_disagreement` | Feature 11 flag | caps at `moderate` |
| `wide_ensemble_spread` | `wind_p90_kn − wind_p10_kn > 15` | caps at `moderate` |
| `no_data_<layer>` | data gap in §7 step 2 or 3 | `low` for that waypoint |

Level starts at `high` and is reduced by the strongest trigger. The passage-level briefing confidence is the lowest level among the waypoints in scope. A narrow ensemble spread near a tropical system stays `low`: the rule-based triggers win over raw spread, by design (v4 §13.3).

### 8.3 Language rules (binding on the prompt and enforced by the validator)
- **Allowed framing:** "conditions suggest", "the ensemble indicates", "this leg carries elevated risk based on forecast data", "consider", "worth cross-checking".
- **Banned phrases (validator regex, case-insensitive):** `safe to (depart|go|leave|proceed|sail)`, `you should (go|depart|leave|proceed|wait)`, `go/no-go`, `it is (safe|unsafe)`, `green light`, `all clear`, `we recommend (you )?(depart|go|leave)`, `do not (go|depart|leave|sail)`, `must (depart|wait|go)`.
- **Standing statement, appended by code, not by the model:** "This briefing supports, and does not replace, the master's own passage-planning responsibility under SOLAS Chapter V Regulation 34. Verify against official forecasts, charts and tide tables before acting."
- The app is never positioned, in UI copy or model output, as planning the passage for the captain.

### 8.4 Validator behaviour
1. Parse the structured output. Run the banned-phrase regexes over every text field.
2. On a violation: retry once with the violations appended to the user turn ("Rewrite without these phrases: …").
3. On a second violation: store the briefing with `validator_passed = false`, show "Briefing unavailable. Raw data below." Never show unvalidated text.
4. `validator_result` records `{passed, violations, attempts}`.

### 8.5 Prompt contract (edge function `generate-briefing`)
- SDK: `@anthropic-ai/sdk` (Deno: `npm:@anthropic-ai/sdk`). Model from `BRIEFING_MODEL`, default `claude-opus-5`. Thinking left at its adaptive default; `output_config: { effort: "medium", format: <JSON schema below> }`; `max_tokens: 4096` (deliberately short output). Enable the server-side refusal fallback (`betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"`) and handle `stop_reason === "refusal"` by failing closed like a validator failure.
- **System prompt (frozen, versioned in `BRIEFING_PROMPT_VERSION`, cached):** role (marine forecaster writing for a professional captain), the allowed/banned language lists, the instruction that `confidence_level` is given and must be stated in the first two sentences when `moderate` or `low`, the instruction to name disagreement legs explicitly, unit conventions (knots, metres, degrees true, UTC plus local offset), and a 250-word ceiling on `summary_text`.
- **User turn:** JSON `{ passage: {name, departure, vessel: {name, thresholds}}, scope, confidence_level, confidence_triggers, legs: [ {sequence, name, eta, lead_time_hours, wind: {p10,p50,p90,dir,gust_p90}, comparison: {source, wind, dir, delta_speed, delta_dir, disagreement}, sea: {wave, wave_dir, period, swell, swell_dir, swell_period}, tide: {height, state, datum}, current: {speed, sets_toward}, ukc: {estimate, basis}, risk_flag, risk_reasons, anchorage?: {...} } ], previous_briefing_summary?: string, material_changes?: [...] }`.
- **Output JSON schema:** `{ summary_text: string, recommended_action: string, per_leg_notes: [{sequence, note}], suggested_departure_windows: [{start, end, reason}], disagreement_notes: string | null }`.
- Store the exact user-turn JSON in `input_snapshot`, its SHA-256 in `input_hash`, the model id in `model_used`.

### 8.6 Continuous monitoring
MGN 615 and SOLAS V/34 frame passage planning as ongoing monitoring. Feature 12 is core v1 for that reason, not polish.

### 8.7 Under-keel clearance as a compound risk
Tide height and swell height for the same hour are always rendered together (one chart, two series, one UKC line) on anchorage and shallow waypoint views. Never in separate panels.

---

## 9. Design system and screens

Reference images live in `references/` next to this file (docs/references/ in the app repo). Windy's mobile wind map (the fifth reference) is not committed because of size; what is borrowed from it is described below.

### 9.1 What each reference contributes
| Reference | Borrow | Ignore |
|---|---|---|
| `01-fortress-terminal-professional-mode.jpg` (trading terminal) | Near-black layered surfaces, KPI strip in the header (AUM / P&L / VaR becomes Distance / Arrival / Max wind p90 / Max wave / Flags), panel grid, monospaced numerics, colour only where it means something | Sidebar depth, order-entry chrome |
| `02-flux-hero-card-simplified-mode.jpg` (SaaS dashboard) | The hero card pattern for the briefing in Simplified mode: greeting line becomes "Passage: {name}", four stat tiles become Confidence / Worst leg / Departure window / Re-check age | The purple gradient; use a flat teal-on-navy card |
| `03-flightradar24-field-cards-waypoint-detail.jpg` (FR24 flight detail) | Waypoint detail sheet: small caps label + value field cards, two per row; the "locked" state repurposed as a **"no data at this tenor"** placeholder so gaps are visible, not blank; the paired altitude/speed chart becomes the tide + swell chart | Ads, upsell card |
| `04-flightradar24-map-plus-panel-passage-builder.jpg` (FR24 map) | Map dominant, bottom/side panel for the selected object with origin → destination, progress bar and ETA; dark map tiles | Aircraft density, light/dark toggle in the header |
| Windy mobile wind map (not committed) | Bottom timeline scrubber with day labels and a play control, repurposed as "time along passage"; wind speed legend bar with knots | Its colour ramp on a dark background |

### 9.2 Tokens (Tailwind theme extension)
```
--bg-0:   #0B1220   page
--bg-1:   #111A2E   panels
--bg-2:   #182338   cards, hover
--border: #23304A
--text-1: #E6EDF7   primary (off-white, never #FFF)
--text-2: #9AA8C0   secondary
--text-3: #66748F   muted / labels
--accent: #2DD4BF   teal: primary actions, current-model line, focus ring
--risk-green: #34D399
--risk-amber: #FBBF24
--risk-red:   #F87171
--flag-violet: #A78BFA   source disagreement marker only
--gap: repeating diagonal hatch of --text-3 at 20% for "no data"
```
Rules: saturated colour appears only as risk, disagreement, or the one teal accent. Charts use thin bright lines and translucent fills (`--accent` at 20% for p10..p90 band, solid for p50). Wind ramp for map and bars, designed for dark: `#1E3A8A → #0EA5E9 → #2DD4BF → #A3E635 → #FBBF24 → #F97316 → #EF4444 → #C026D3` across 0, 5, 10, 15, 20, 30, 40, 50+ kn. Never start a ramp at white.

### 9.3 Type
- UI: Inter (or system sans), 14 px base.
- Numerics and tables: JetBrains Mono with `font-variant-numeric: tabular-nums`, so columns align.
- Labels: 11 px, uppercase, `--text-3`, letter-spacing 0.06em (the FR24 field-card style).

### 9.4 Components
- **KPI strip:** label above value, value in mono, delta or flag beside it.
- **Leg row:** sequence, name, ETA (UTC + local), lead time, wind p10/p50/p90 as a mini band with the p50 as a tick, direction arrow (rotated SVG, "from" convention), gust p90, wave + period, swell + direction, tide height + state glyph, current + "sets toward" arrow, UKC, comparison delta, disagreement badge, risk pill, confidence dot.
- **Field card:** label + value; hatched when null with the reason on hover ("no marine grid point within 55 km").
- **Band chart:** time on x, p10..p90 band, p50 line, comparison model as a dashed line, vessel limit as a horizontal red line.
- **Tide + swell pairing:** one chart, tide as an area, swell as a line, UKC as a computed line with `min_ukc_m` shaded.
- **Disclaimer bar:** fixed, non-dismissible on chart views.
- **Attribution footer:** "Weather data by Open-Meteo.com (CC-BY 4.0). Tides by TidesAtlas. Charts: OpenSeaMap contributors, NOAA."

### 9.5 Screens
1. **Passage builder:** map (dark tiles) with pins and route polyline; right panel with waypoint list (drag to reorder), import buttons (GPX, CSV), vessel picker, departure time; per-waypoint sheet with anchorage toggle, stay end, exposure tag, complex-coastal toggle, charted depth.
2. **Dashboard, Professional (default):** KPI strip, leg table, band chart for the selected leg, comparison toggle, "Re-check" button when active, GPX export.
3. **Dashboard, Simplified:** map with risk-coloured legs, hero briefing card, stat tiles, "show table" link always visible.
4. **Comparison view:** two columns per leg (primary ensemble, comparison model) with deltas, flagged rows in violet, source and init time shown for each.
5. **Vessel profile:** thresholds form with units in labels; a live preview of what the current passage's flags would be with the edited values.
6. **Passage history:** list with status, date, worst flag, last briefing confidence.
7. **Anchorage stay view:** stay window summary tiles, tide + swell paired chart, wind rose for the window, exposure tag.
8. **Active passage monitoring:** progress along route, arrived toggles per waypoint, re-check button, material-changes banner, briefing diff (previous summary collapsed underneath).

Mobile: single column, table becomes stacked leg cards with the same fields, map collapses to a header strip.

---

## 10. Data model

Authoritative DDL: [schema.sql](schema.sql). What changed versus v4 §7 and why:

| Table | Change vs v4 | Reason |
|---|---|---|
| `app_settings` | new | thresholds and source selection are tunable without a deploy (v4 open decision #7) |
| `vessels` | + `draft_m`, `air_draft_m`, `beam_m`, `max_gust_kn`, `max_current_kn`, `min_ukc_m`, `updated_at` | UKC and gust rules |
| `passages` | status CHECK, `actual_departure`, `tropical_activity_flag`, `frontal_activity_flag`, `owner_id` | manual v1 confidence triggers; re-anchoring |
| `waypoints` | PostGIS `geom`, `planned_speed_kn`, `leg_distance_nm`, `leg_bearing_deg`, `anchorage_exposure_tag`, `is_complex_coastal`, `charted_depth_m`, `arrived_at`, deferred unique on sequence | engine outputs, v1 manual triggers, reorder safety |
| `ingest_targets` + `passage_ingest_targets` | new | demand-driven ingestion (§11) |
| `forecast_atmospheric` | keyed on `target_id`; `kind`; `lead_time_hours` generated; direction as mean + spread; raw member arrays; units in names | float-drift-proof upserts, correct circular stats, recomputable quantiles |
| `forecast_comparison` | table → **view** | one cache, one adapter shape |
| `forecast_marine` | + wave direction, wind-wave, swell height/period, sea level (model), currents, SST, `init_time` | everything Open-Meteo Marine provides that the join uses |
| `forecast_tidal` | station fields, `datum`, no `init_time`; currents removed | tides are harmonic; currents come from marine |
| `chart_features` | geography column + GiST instead of jsonb + GIN | spatial index that actually works |
| `conditions_runs` | new | Feature 12 diffing |
| `waypoint_conditions` | `run_id`, sources and init times used, comparison fields, UKC fields, `confidence_triggers`, `risk_reasons`, unique per run | auditability |
| `anchorage_conditions` | `run_id`, worst-case fields, direction range, exposure tag, min UKC | Feature 10 |
| `passage_briefings` | `run_id`, `scope`, `material_changes`, `prompt_version`, `input_snapshot`, `input_hash`, `validator_result` | governance and reproducibility |

Row-level security is on for every table. Supabase's service role bypasses it for the edge functions.

---

## 11. Ingestion and scheduling (NEW detail)

1. **Target generation** (edge function `plan-targets`, called by the UI after any waypoint or departure change, and by `compute-conditions` before a run): sample each leg every `ingest_grid.spacing_deg` along the great circle, snap to the model grid (0.25°), dedupe, upsert `ingest_targets` per layer with `horizon_end = max ETA + 24 h` (anchorages: stay end + 24 h), link via `passage_ingest_targets`. Tidal targets resolve a station on first fetch. Targets whose passages are all completed or archived are set `active = false`.
2. **Tick** (edge function `ingest-tick`, `POST {layer}` with `x-cron-secret`): respond `202` immediately; in `EdgeRuntime.waitUntil()` select up to 20 due targets for the layer (`active and next_fetch_at < now()`), call the adapter, upsert rows on the unique key, set `last_fetched_at`, `last_init_time`, and `next_fetch_at` (atmospheric and comparison: next model cycle + 90 min; marine: + 6 h; tidal: + 24 h). On adapter error, write `last_error` and back off 30 min.
3. **Cron** (in `schema.sql`, Supabase only): four jobs every 15 min (tidal daily) plus a 03:30 UTC purge. All jobs post to the same function with `timeout_milliseconds := 5000`; nothing waits on the response.
4. **Rate budget:** a 300 nm passage at 0.25° is roughly 25 grid points × 4 layers × 2 atmospheric models. Well under 10,000 calls/day even with hourly refresh.
5. **Idempotency:** every write is an upsert on the unique key; re-running a tick is harmless.
6. **Manual "fetch now"** in the UI calls `ingest-tick` for all layers with `force = true`, which ignores `next_fetch_at`.

---

## 12. App repo file structure (NEW)

The app lives in its own repo (working name `captain-passage-tool`). This wiki folder holds the spec; the repo README links back here.

```
captain-passage-tool/
├── README.md                         # links to this PRD; stack table like travel/detour
├── .env.example                      # names only, no values
├── package.json  vite.config.ts  tailwind.config.ts  tsconfig.json
├── index.html
├── src/
│   ├── main.tsx  App.tsx  routes.tsx
│   ├── lib/
│   │   ├── supabase.ts               # client + typed Database
│   │   ├── passage-engine/           # §6, pure functions + tests
│   │   │   ├── geo.ts  engine.ts  engine.test.ts
│   │   ├── units.ts                  # kn/kmh/ms, m/ft, deg helpers, circular mean
│   │   ├── gpx.ts  csv.ts            # importers → Waypoint[]
│   │   └── risk-colors.ts            # token mapping, wind ramp
│   ├── components/
│   │   ├── map/        PassageMap.tsx  WaypointMarker.tsx  RouteLine.tsx  ChartOverlays.tsx  DisclaimerBar.tsx
│   │   ├── dashboard/  KpiStrip.tsx  LegTable.tsx  LegRow.tsx  BandChart.tsx  TideSwellChart.tsx  FieldCard.tsx  RiskPill.tsx  DisagreementBadge.tsx
│   │   ├── briefing/   BriefingCard.tsx  MaterialChangesBanner.tsx  ConfidenceDot.tsx
│   │   ├── comparison/ ComparisonTable.tsx
│   │   ├── anchorage/  StayWindowView.tsx  WindRose.tsx
│   │   ├── vessel/     VesselForm.tsx  ThresholdPreview.tsx
│   │   └── ui/         (shadcn generated)
│   ├── pages/
│   │   PassageBuilder.tsx  DashboardPro.tsx  DashboardSimple.tsx  ComparisonView.tsx
│   │   VesselSettings.tsx  PassageHistory.tsx  AnchorageStay.tsx  ActivePassage.tsx
│   ├── hooks/          usePassage.ts  useConditions.ts  useBriefing.ts  useDisplayPrefs.ts
│   └── types/          database.ts (generated)  domain.ts
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   └── 0001_init.sql             # copy of wiki schema.sql
│   ├── seed.sql                      # one vessel, one 3-leg fixture passage
│   └── functions/
│       ├── _shared/
│       │   ├── adapters/  openMeteoEnsemble.ts  openMeteoGfs.ts  openMeteoMarine.ts  tidesAtlas.ts  worldTides.ts  types.ts
│       │   ├── contracts.ts          # IngestTarget, ForecastRow shapes
│       │   ├── stats.ts              # percentiles, circular mean/spread
│       │   ├── confidence.ts         # §8.2 triggers + level
│       │   ├── language-rules.ts     # §8.3 banned phrases + standing statement
│       │   ├── risk.ts               # §7 step 7
│       │   ├── ukc.ts                # §7 step 6
│       │   ├── engine.ts             # re-export of src/lib/passage-engine (built)
│       │   └── supabaseAdmin.ts
│       ├── plan-targets/index.ts
│       ├── ingest-tick/index.ts
│       ├── compute-conditions/index.ts
│       └── generate-briefing/index.ts
├── scripts/
│   ├── enc-to-geojson.sh             # §5.5
│   └── fixtures/  passage-3leg.csv  passage-3leg.gpx  divergence-fixture.json
└── tests/
    ├── engine.test.ts  risk.test.ts  confidence.test.ts  language-rules.test.ts  stats.test.ts
    └── e2e/  builder.spec.ts (Playwright)
```

---

## 13. Build sequence

| Phase | Scope | Exit criteria |
|---|---|---|
| **1. MVP (personal)** | Supabase project + migration 0001; auth; vessel form; passage builder with pins, GPX, CSV; passage engine; `plan-targets`; ensemble, GFS, marine and tidal adapters; `ingest-tick` + cron; `compute-conditions`; Professional dashboard as default; comparison columns; disclaimer + attribution | Feature 1, 2, 3, 4, 9, 11 acceptance criteria pass on the 3-leg fixture. Tables fill unattended overnight. |
| **2. Briefing + views** | `generate-briefing` with §8 governance, validator and fail-closed; Simplified dashboard; comparison view; chart overlays; tide + swell pairing | Feature 5, 6, 7 criteria pass. A 7-day-out fixture yields `low` confidence stated in words. |
| **3. Anchorage + re-check + polish** | anchorage stay view; Feature 12 re-check with material-change banner; passage history; departure-window suggestions; display preference `narrative_emphasis`; mobile pass | Feature 10, 12 criteria pass. |
| **4. v2 (gated on §14)** | WeatherNext 3 BigQuery adapter; NOMADS GRIB second pipe; automated confidence feeds (tropical, frontal, coastline); scheduled re-checks; hazard-aware engine; shelter/seabed modelling; multi-tenant auth; provider and licensing review | Not started until §14 is resolved. |

Each phase ends with the repo's own checks green: `vitest`, `tsc --noEmit`, `eslint`, and the SQL applied to a fresh local Supabase.

---

## 14. Licensing and legal (v1 posture)

- Personal single-user use only. No public URL, no sharing, no advertising, no subscription.
- Open-Meteo non-commercial terms and CC-BY attribution (§5.6).
- WeatherNext experimental terms and disclaimer (§5.6). Before any v2: contact `weathernext@google.com` for commercial terms; evaluate ECMWF open data, NOAA/GFS, or a commercial marine API as licensed fallbacks.
- TidesAtlas, WorldTides, OpenSeaMap: verify commercial terms before v2.
- NOAA ENC and CO-OPS: US public domain, geographically limited.
- Persistent in-app disclaimer: not validated for real-world navigation decisions; does not replace official charts, tide tables or agency warnings; does not replace the master's passage-planning responsibility under SOLAS V/34.

---

## 15. Open decisions

Still open after this pass:

1. **App name.**
2. **Wiki home for the code lane.** This spec sits in `brain/projects/`. If the app repo, migrations and deploy notes should live in the wiki like `travel/detour/`, that needs Hugo's ruling on a top-level personal lane for captain tools (schema change, v1.6).
3. **Disagreement thresholds** (5 kn / 15°) and the 8 kn light-air floor: tune against real passages after a season; they live in `app_settings`, not code.
4. **Current-adjusted ETAs** default off in v1. Turn on once SMOC has been compared against the log on a few passages.
5. **TidesAtlas datum handling** once real responses are seen: if the datum is not stated, the UI must label tide heights "datum unknown" rather than assume CD.
6. **WeatherNext 3 in v2:** whether member-level 10 m wind is queryable in BigQuery or only precomputed percentiles. Check the BigQuery guide before designing that adapter.

Resolved in this pass (were open in v4): LLM provider and model (§2 #14); NOAA ENC parsing timing (pre-processed static GeoJSON, §5.5); exposure self-tag for anchorages (yes, v1, `anchorage_exposure_tag`); comparison source (§2 #3).

---

## 16. Follow-up research (not yet done)

- How Admiralty/UKHO, national met services and established routing providers phrase accuracy disclaimers and confidence, to borrow proven liability-conscious language for §8.3.
- Real-world WeatherNext 2/3 vs GFS/ECMWF divergence in coastal and marine scenarios once independent verification accumulates. Global leaderboard skill does not tell us how it behaves in a strait.
- Whether Open-Meteo's `google_weathernext2_ensemble` carries the same experimental-terms caveat as Google's direct feed. Assume yes until read.

---

## Provenance note

External-API facts in §5 and §11 were checked against the official docs' source repositories on GitHub on 2026-09-04 because the vendor sites were unreachable from the drafting sandbox. TidesAtlas, WeatherNext 3 and NOAA ENC details came from search snippets of official pages and are marked "re-check at build time". Nothing here was applied to any live database.
