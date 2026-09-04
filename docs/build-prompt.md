# Captain Passage Tool: Claude Code session opener

Parent: [_index](https://github.com/superyachtsundayschool/wiki/blob/main/brain/projects/captain-passage-tool/_index.md)
Spec: [prd](prd.md) · Schema: [schema.sql](schema.sql)

Paste the block below into a fresh Claude Code session inside an empty repo (working name `captain-passage-tool`). Replace `{PHASE}` with the phase number from PRD §13. The prompt is written for Claude Code; a Lovable variant follows at the bottom.

---

## Paste-ready prompt

```
You are building Phase {PHASE} of a personal web app called Captain Passage Tool for a working yacht captain. It is single-user, non-commercial, and used for real passage planning, so correctness and honesty about uncertainty matter more than polish.

The full specification is in my wiki at docs/ in this repo (copied from ~/sss-wiki/brain/projects/captain-passage-tool/):
  - prd.md        the Master PRD v5. Read it end to end before writing code. §2 lists decisions already made; do not reopen them.
  - schema.sql    migration 0001. Copy it verbatim to supabase/migrations/0001_init.sql. It has been executed against Postgres 16 + PostGIS and passes a smoke test. Do not restructure it; additive migrations only.
  - build-prompt.md  this file.

Stack (fixed): React 18 + Vite + TypeScript, Tailwind, shadcn/ui, react-leaflet + @geoman-io/leaflet-geoman-free, @tmcw/togeojson, @dnd-kit/sortable. Supabase (own project, PostGIS, RLS) with Edge Functions in Deno/TypeScript and pg_cron + pg_net defined in SQL. Briefings call Claude through the official @anthropic-ai/sdk with the model id read from BRIEFING_MODEL (default claude-opus-5), structured JSON output via output_config.format, effort medium, and the server-side refusal fallback enabled.

Non-negotiables, all from the PRD:
  1. Raw data first. The Professional table is the default landing view. The AI briefing never hides or replaces it.
  2. Advisory language only. The briefing may say "conditions suggest" or "this leg carries elevated risk". It may never say "safe to depart", "you should go", or anything that implies the app makes the go/no-go call. The banned-phrase validator in PRD §8.3–8.4 runs on every briefing: one retry, then fail closed and show "Briefing unavailable. Raw data below."
  3. Confidence is computed by rules (PRD §8.2) before the model is called and injected as a constraint. Lead time beyond 120 hours is always low confidence, stated in plain words in the first two sentences.
  4. Every briefing ends with the SOLAS V/34 standing statement, appended by code, not by the model.
  5. Persistent, non-dismissible disclaimer on every screen with a chart overlay. Attribution footer for Open-Meteo (CC-BY 4.0), TidesAtlas, OpenSeaMap, NOAA.
  6. RLS stays on. Edge functions use the service role; the browser never does.
  7. Never display Open-Meteo sea_level_height_msl as a tide height. Tide comes from the tidal adapter with its datum shown.
  8. Wind direction is a circular quantity: circular mean and spread, never percentiles. Units live in column and variable names.
  9. Ingestion is demand-driven and asynchronous (PRD §11): ingest-tick responds 202 immediately and works in EdgeRuntime.waitUntil().
  10. No secrets in the repo. .env.example lists names only.

Repo layout: follow PRD §12 exactly. Put the passage engine in src/lib/passage-engine as pure functions with tests, and share it with the edge functions through supabase/functions/_shared.

Design: dark only, tokens and rules in PRD §9.2–9.4. Saturated colour is reserved for risk (green/amber/red), the violet disagreement marker, and one teal accent. Numerics in JetBrains Mono with tabular figures. The reference images are in the wiki folder under references/; PRD §9.1 says what to borrow from each.

Working method:
  - Start by reading prd.md and schema.sql in full, then write a short plan for this phase mapped to the acceptance criteria in PRD §4 and the exit criteria in §13. Then build.
  - Write tests as you go: engine, risk, confidence, language rules, stats (percentiles and circular mean). Use the fixtures described in PRD §4 (3-leg passage, divergence fixture, 7-day-out fixture).
  - Before you call any phase done, run: vitest, tsc --noEmit, eslint, and apply the migration to a fresh local Supabase (supabase db reset). All green or it is not done.
  - Verify external API parameter names against the live docs before wiring an adapter; the PRD marks TidesAtlas, WeatherNext 3 and NOAA ENC as "re-check at build time".
  - If something in the PRD is impossible as written, do not silently change it. Build the rest, then tell me exactly what is blocked and propose the smallest change.
  - Do not ask me questions that the PRD already answers.

Deliver Phase {PHASE} with: the code, passing checks, a README that links back to the wiki PRD and lists the stack in a table, and a short note of anything you deviated from and why.
```

---

## Lovable variant (only if the stack is ever moved there)

Lovable owns the React front end and connects to the same Supabase project. Edge functions, migrations and cron stay in the repo and are deployed with the Supabase CLI. Paste PRD §1, §4, §6 (as behaviour), §9 and the ten non-negotiables above into Lovable's project prompt. Point it at the generated `types/database.ts`. Do not let it author SQL; the schema is already decided.

---

## Phase checklist (copy into the session as you go)

- Phase 1: schema applied · auth · vessel form · builder (pins, GPX, CSV) · engine + tests · plan-targets · four adapters · ingest-tick + cron · compute-conditions · Professional dashboard · comparison columns · disclaimer + attribution · fixture passage fills overnight unattended
- Phase 2: generate-briefing + validator + fail-closed · Simplified dashboard · comparison view · chart overlays · tide + swell pairing · 7-day-out fixture states low confidence in words
- Phase 3: anchorage stay view · re-check with material-changes banner · passage history · departure windows · narrative_emphasis preference · mobile pass
