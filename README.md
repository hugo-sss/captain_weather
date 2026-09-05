# Captain Passage Tool

Personal weather and passage intelligence web app for a working yacht captain: import a passage plan, get per-waypoint ETAs joined against an atmospheric ensemble, sea state and tide, a second model alongside for cross-checking, an anchorage stay-window forecast, and a plain-English briefing bound to advisory language.

Single-user, non-commercial. Not validated for navigation decisions. Supports, and does not replace, the master's passage-planning responsibility under SOLAS V/34.

## Spec

| File | What |
|---|---|
| `docs/prd.md` | Master PRD v5, the build-ready spec. Source of truth lives in the sss-wiki repo at `brain/projects/captain-passage-tool/prd.md`. |
| `docs/build-prompt.md` | Claude Code session opener and per-phase checklist. |
| `docs/schema.sql` / `supabase/migrations/0001_init.sql` | Migration 0001. Executed and smoke-tested on Postgres 16 + PostGIS. Additive migrations only after this (0002–0004 are additive). |
| `docs/references/` | Four design reference images mapped to screens in PRD §9.1. |

## Stack

| Layer | Choice | Where |
|---|---|---|
| Front end | React 18, Vite 7, TypeScript 5.9, Tailwind 3.4, shadcn-style primitives on Radix | `src/` |
| Map | react-leaflet 4 + leaflet-geoman-free (pins, drags), OpenStreetMap base (desaturated for dark), OpenSeaMap overlay, NOAA ENC GeoJSON overlay from `chart_features` | `src/components/map/` |
| Importers | `@tmcw/togeojson` (GPX), hand-rolled CSV, `@dnd-kit/sortable` for reordering | `src/lib/gpx.ts`, `src/lib/csv.ts` |
| Charts | recharts (band chart, tide + swell pairing with UKC line) | `src/components/dashboard/` |
| Passage engine + rules | Pure TypeScript, shared by UI and edge functions | `src/lib/passage-engine/`, `supabase/functions/_shared/` |
| Database + auth | Supabase project `jyhaavppeilbxzikuhfg` (eu-north-1), Postgres 17 + PostGIS 3.3, RLS on every table, email magic link | `supabase/migrations/` |
| Scheduling | pg_cron + pg_net, jobs defined in SQL (0001 cron block) | `supabase/migrations/0001_init.sql` |
| Ingestion + compute | Edge Functions (Deno): `plan-targets`, `ingest-tick`, `compute-conditions` | `supabase/functions/` |
| Briefing | Edge Function `generate-briefing` via `@anthropic-ai/sdk` 0.123 (`claude-opus-5` default, structured JSON output, effort medium, server-side refusal fallback) | `supabase/functions/generate-briefing/` |
| Data sources | Open-Meteo Ensemble (`google_weathernext2_ensemble`, `ecmwf_ifs025_ensemble`), Open-Meteo Forecast (`ncep_gfs_global`), Open-Meteo Marine (`meteofrance_wave`, `meteofrance_currents`), TidesAtlas (WorldTides fallback) | `supabase/functions/_shared/adapters/` |
| Tests | vitest (engine, stats, risk, confidence, language rules, adapters, targets) | `tests/` |

## Running it

```bash
pnpm install
cp .env.example .env.local          # fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (publishable key)
pnpm dev                            # http://localhost:5173
pnpm check                          # tsc --noEmit, eslint, vitest
pnpm db:check                       # applies every migration to a fresh local Postgres 16 + PostGIS
```

Sign in with the magic link. In the Supabase dashboard set **Authentication → URL Configuration → Site URL** to the URL you run the app from (for local dev `http://localhost:5173`) or the link will not land back in the app.

## Secrets

Never committed. `.env.example` lists names only. Deployed edge functions read these from **Supabase dashboard → Edge Functions → Secrets** (project `jyhaavppeilbxzikuhfg`):

| Secret | Needed by | Without it |
|---|---|---|
| `TIDESATLAS_API_KEY` | `ingest-tick` (tidal layer) | Tidal targets record `not configured: TIDESATLAS_API_KEY not set`; the dashboard shows tide as a data gap with that reason; confidence gets `no_data_tidal`. |
| `ANTHROPIC_API_KEY` | `generate-briefing` (default provider) | A briefing row is stored with `model_used = 'unavailable'` and the UI shows "Briefing unavailable: ANTHROPIC_API_KEY not set" above the raw data. |
| `BRIEFING_PROVIDER` | `generate-briefing` | `anthropic` (default) or `openai` to use any OpenAI-compatible gateway. |
| `BRIEFING_BASE_URL` + `BRIEFING_API_KEY` + `BRIEFING_MODEL` | `generate-briefing` when `BRIEFING_PROVIDER=openai` | Point at Synthetic (`https://api.synthetic.new/v1`, model alias e.g. `syn:large:text`), z.ai, OpenRouter, etc. When any are unset in the function env, they are read from the `briefing_config()` RPC: the key from Vault secret `briefing_api_key`, and provider/base_url/model from the `app_settings` row `briefing` (SECURITY DEFINER, service role only, migration 0007). Missing all sources stores an unavailable row with the reason. Reasoning models (GLM) emit reasoning tokens before the JSON, so the request budgets `max_tokens: 8192`. |
| `BRIEFING_MODEL` | `generate-briefing` | defaults to `claude-opus-5` |
| `BRIEFING_PROMPT_VERSION` | `generate-briefing` | defaults to `v1` |
| `CRON_SECRET` | `ingest-tick` | Optional. When unset, the function reads the Vault secret `cron_secret` through `public.cron_secret()` (service role only, migration 0004), which is the same value pg_cron sends. Setting it in the function env overrides that. |
| `WORLDTIDES_API_KEY` | `ingest-tick` | Only if `app_settings.sources.tidal` is switched to `worldtides`. |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected into edge functions by Supabase. The browser only ever holds the publishable key; RLS does the rest.

Vault holds `functions_url` and `cron_secret` (created at project setup). To read the cron secret for manual testing: `select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'` in the SQL editor.

## Deploying edge functions

With the Supabase CLI: `supabase functions deploy plan-targets ingest-tick compute-conditions --project-ref jyhaavppeilbxzikuhfg` (the CLI resolves `_shared` itself; `ingest-tick` must keep `verify_jwt = false`, see `supabase/config.toml`).

Without the CLI: `pnpm functions:bundle` writes one self-contained file per function to `supabase/functions/<name>/bundle/index.ts` (esbuild, `npm:`/`jsr:` imports left external) for upload through the dashboard or the Supabase MCP tool. That is how Phase 1 was deployed.

## How the pieces fit (Phase 1)

1. **Builder** writes `passages` + `waypoints` (map pins, GPX route/track, CSV `name,lat,lon[,is_anchorage,stay_hours]`). Reorders save in one request so the deferred unique constraint on `(passage_id, sequence)` holds.
2. **plan-targets** runs the engine (haversine, R = 3440.065 nm), persists ETAs, samples the route every 0.25° and upserts `ingest_targets` for atmospheric, comparison and marine; tidal targets sit at the waypoints themselves (station-based, credit-metered). Stale targets are deactivated.
3. **ingest-tick** (pg_cron every 15 min, tidal daily; or "Fetch now" in the UI) responds 202 and processes up to 20 due targets per layer in `EdgeRuntime.waitUntil()`. GFS rows are keyed on the co-located atmospheric target so the `forecast_comparison` view lines up.
4. **compute-conditions** creates a `conditions_runs` row, joins each waypoint ETA to the newest init of each layer (nearest hour, or interpolated when > 90 min away; circular for directions), computes disagreement (5 kn / 15°, gated at 8 kn), UKC, the risk flag and the rule-based confidence, and writes `waypoint_conditions` and `anchorage_conditions`.
5. **Professional dashboard** (default view) reads those tables directly: KPI strip, leg table with p10/p50/p90 band, comparison columns, hatched "no data" cells with the reason, band chart per leg, risk-coloured map with the non-dismissible chart disclaimer.

## Briefing governance (Phase 2)

`generate-briefing` builds the §8.5 user turn from the latest complete run, computes passage confidence by rules first (lowest waypoint level) and injects it with a plain-words statement, then calls the configured model backend with a frozen, versioned system prompt (`BRIEFING_PROMPT_VERSION`). The default backend is Claude (`@anthropic-ai/sdk`, structured JSON output, `fallbacks: "default"`); setting `BRIEFING_PROVIDER=openai` routes to any OpenAI-compatible gateway (Synthetic GLM/Kimi, z.ai, OpenRouter) with `response_format: json_object` and the schema spelled out in the prompt. Either way it runs the §8.3 banned-phrase regexes over every text field. One retry with the violations quoted, then it fails closed: the row is stored with `validator_passed = false` and the UI shows "Briefing unavailable. Raw data below." A refusal or truncated output fails closed the same way. When confidence is moderate or low and the model did not state it in the first two sentences, the rule-based statement is prepended by code (`validator_result.confidence_prepended = true`). The SOLAS V/34 standing statement is appended by code, never by the model. Views: Professional (default), Simplified (`/passages/:id/simple`), Comparison (`/passages/:id/comparison`).

## Phase 3: anchorage, re-check, history, mobile

- **Anchorage stay view** (`/passages/:id/anchorage/:wpId`): stay-window tiles from `anchorage_conditions` (median and worst-case wind, gust, predominant direction and veer arc, max wave and swell with direction, tide min/max/range, minimum UKC), the tide + swell chart over the stay, a 16-sector wind rose for the window, the manual exposure tag.
- **Monitor** (`/passages/:id/active`): progress along the route, arrived toggles (re-anchor the engine from the last arrived waypoint), "Re-check conditions" (a `recheck` run pointing at the previous one, then a `remaining` briefing), material-changes banner before any numbers (from the briefing, or a client-side diff of run N vs N-1 with the same rules), previous briefing summary collapsed underneath.
- **Passage history**: status, departure, worst flag of the latest run, last briefing confidence.
- **Departure windows**: two sources, labelled. Rule-derived from the raw series at the first waypoint (p90 wind, gust and wave under 0.75× the limits, models in agreement, at least 3 contiguous hours), and the briefing model's suggestions. Neither is a recommendation.
- **narrative_emphasis** (slider in the header, 0..1): at 0.5 and above the briefing card moves above the table on the Professional view. Ordering and emphasis only; every number stays reachable at every value.
- **Mobile**: the leg table becomes stacked leg cards with the same fields, the map collapses behind a "Show map" strip, the builder goes single column.

## Licensing posture

Open-Meteo non-commercial tier, CC-BY 4.0 attribution shown in the footer. WeatherNext real-time data under Google DeepMind's experimental terms (personal single-user use). TidesAtlas, OpenSeaMap: verify commercial terms before any v2. NOAA ENC: public domain, not certified for navigation.
