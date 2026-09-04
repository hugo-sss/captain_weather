# Captain Passage Tool

Personal weather and passage intelligence web app for a working yacht captain: import a passage plan, get per-waypoint ETAs joined against an atmospheric ensemble, sea state and tide, a second model alongside for cross-checking, an anchorage stay-window forecast, and a plain-English briefing bound to advisory language.

Single-user, non-commercial. Not validated for navigation decisions. Supports, and does not replace, the master's passage-planning responsibility under SOLAS V/34.

## Spec

| File | What |
|---|---|
| `docs/prd.md` | Master PRD v5, the build-ready spec. Source of truth lives in the sss-wiki repo at `brain/projects/captain-passage-tool/prd.md`. |
| `docs/build-prompt.md` | Claude Code session opener and per-phase checklist. |
| `docs/schema.sql` / `supabase/migrations/0001_init.sql` | Migration 0001. Executed and smoke-tested on Postgres 16 + PostGIS. Additive migrations only after this. |
| `docs/references/` | Four design reference images mapped to screens in PRD §9.1. |

## Stack

To be filled in by the build session (React + Vite + TypeScript, Tailwind, shadcn/ui, react-leaflet; Supabase with PostGIS, RLS, pg_cron + pg_net, Edge Functions; briefing via `@anthropic-ai/sdk`).

## Secrets

Never committed. See `.env.example` once the build session creates it. Deployed edge functions need `TIDESATLAS_API_KEY`, `ANTHROPIC_API_KEY`, `CRON_SECRET`.
