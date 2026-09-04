-- =============================================================================
-- Captain Passage Tool — Supabase schema, migration 0001 (v1 personal build)
-- Spec: brain/projects/captain-passage-tool/prd.md  (§10 Data model)
--
-- RUN ON A NEW, DEDICATED SUPABASE PROJECT. Never on the SSS projects
-- (CV-AI-Review ldetpgcjwmbhljgxpkms or SSS_Brain zmiikssbwzkukfqqxjew).
-- Same ruling as travel/detour: personal apps get their own project.
--
-- Design rules baked in here (see PRD §2 for the why):
--   * PostGIS geography on every located row; nearest-grid joins use <->.
--   * Forecast caches are keyed on (target_id, source, init_time, forecast_time)
--     so float drift in lat/lon can never break an upsert.
--   * Units live in column names: _kn, _m, _hpa, _deg, _s, _c.
--   * Wind direction is stored as circular mean + spread. Never percentiles.
--   * timestamptz everywhere. No bare timestamp.
--   * RLS on from day one, owner-scoped, so multi-user is a config change.
--   * The cron block at the bottom only executes when pg_cron exists
--     (Supabase). The file runs cleanly on a plain Postgres 16 + PostGIS.
-- =============================================================================

create extension if not exists postgis;

-- -----------------------------------------------------------------------------
-- 0. Helpers
-- -----------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Smallest angle between two bearings, 0..180. Used for wind-direction deltas.
create or replace function angular_delta_deg(a numeric, b numeric)
returns numeric language sql immutable strict as $$
  select abs(mod(mod(a - b + 540, 360) + 360, 360) - 180)
$$;

-- -----------------------------------------------------------------------------
-- 1. Settings (tunable thresholds; PRD §7, §8, §15)
-- -----------------------------------------------------------------------------

create table app_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);

insert into app_settings (key, value, description) values
  ('disagreement_thresholds',
   '{"wind_speed_kn": 5, "wind_dir_deg": 15}',
   'Feature 11: primary vs comparison delta above which source_disagreement is set. Placeholder values; tune against real passages.'),
  ('confidence_rules',
   '{"low_confidence_lead_time_hours": 120, "moderate_confidence_lead_time_hours": 72}',
   'PRD §8: rule-based confidence downgrades. Lead time beyond 5 days is always low confidence (MCA guidance).'),
  ('risk_defaults',
   '{"amber_fraction_of_limit": 0.75, "gust_factor_if_missing": 1.3}',
   'PRD §7: amber when p90 exceeds this fraction of a vessel limit; red when p50 exceeds the limit.'),
  ('sources',
   '{"atmospheric_primary": "google_weathernext2_ensemble", "atmospheric_secondary": "ecmwf_ifs025_ensemble", "comparison": "ncep_gfs_global", "marine": "open-meteo-marine", "tidal": "tidesatlas"}',
   'Adapter selection. Swap here, not in code.'),
  ('cache_retention_days', '3', 'Forecast cache rows older than this (by init_time) are purged nightly.'),
  ('ingest_grid',
   '{"spacing_deg": 0.25, "corridor_km": 25, "horizon_hours": 240}',
   'How ingest_targets are generated along a passage: grid spacing, corridor half-width, and how far ahead to fetch.');

-- -----------------------------------------------------------------------------
-- 2. Vessels (Feature 9) — thresholds drive risk_flag; draft drives UKC
-- -----------------------------------------------------------------------------

create table vessels (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name            text not null,
  vessel_class    text,                      -- 'motor', 'sail', 'catamaran', 'tender' ...
  length_m        numeric(6,2),
  beam_m          numeric(6,2),
  draft_m         numeric(5,2),              -- required for any UKC estimate
  air_draft_m     numeric(5,2),
  cruise_speed_kn numeric(5,2) not null,
  max_speed_kn    numeric(5,2),
  max_wind_kn     numeric(5,1),              -- sustained wind limit
  max_gust_kn     numeric(5,1),
  max_wave_m      numeric(5,2),              -- significant wave height limit
  max_current_kn  numeric(4,2),
  min_ukc_m       numeric(4,2) not null default 1.0,
  polar_data      jsonb,                     -- optional sail polars {twa: {tws: boatspeed}}
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger vessels_updated before update on vessels for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. Passages + waypoints (Features 1, 2, 10, 12)
-- -----------------------------------------------------------------------------

create table passages (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vessel_id             uuid not null references vessels(id) on delete restrict,
  name                  text not null,
  planned_departure     timestamptz not null,
  actual_departure      timestamptz,
  status                text not null default 'planned'
                        check (status in ('planned','active','completed','archived')),
  -- v1 manual confidence triggers (PRD §8). Feeds replace these in v2.
  tropical_activity_flag boolean not null default false,
  frontal_activity_flag  boolean not null default false,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index passages_owner_status_idx on passages (owner_id, status);
create trigger passages_updated before update on passages for each row execute function set_updated_at();

create table waypoints (
  id                          uuid primary key default gen_random_uuid(),
  passage_id                  uuid not null references passages(id) on delete cascade,
  sequence                    int  not null,
  name                        text,
  lat                         numeric(9,6) not null check (lat between -90 and 90),
  lon                         numeric(9,6) not null check (lon between -180 and 180),
  geom                        geography(Point,4326) generated always as
                                (st_setsrid(st_makepoint(lon::double precision, lat::double precision), 4326)::geography) stored,
  planned_speed_kn            numeric(5,2),          -- per-leg override of vessel cruise speed
  leg_distance_nm             numeric(8,2),          -- from previous waypoint; null on first
  leg_bearing_deg             numeric(5,1),
  eta                         timestamptz,           -- computed by the passage engine
  is_anchorage                boolean not null default false,
  planned_departure_from_here timestamptz,           -- stay window end when is_anchorage
  anchorage_exposure_tag      text check (anchorage_exposure_tag in ('sheltered','partial','exposed')),
  is_complex_coastal          boolean not null default false,  -- manual v1 confidence trigger
  charted_depth_m             numeric(6,1),          -- manual entry in v1; ENC-derived in v2
  arrived                     boolean not null default false,
  arrived_at                  timestamptz,
  source                      text not null default 'map' check (source in ('map','gpx','csv','api')),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (passage_id, sequence) deferrable initially deferred,
  check (not is_anchorage or planned_departure_from_here is not null)
);
create index waypoints_passage_seq_idx on waypoints (passage_id, sequence);
create index waypoints_geom_idx on waypoints using gist (geom);
create trigger waypoints_updated before update on waypoints for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Ingest targets — demand-driven ingestion (PRD §11)
--    One row per (layer, grid point). Cron fetches rows whose next_fetch_at
--    has passed. Passages link to the targets they need so retention knows
--    what is still live.
-- -----------------------------------------------------------------------------

create table ingest_targets (
  id              bigint generated always as identity primary key,
  layer           text not null check (layer in ('atmospheric','comparison','marine','tidal')),
  grid_lat        numeric(6,3) not null,
  grid_lon        numeric(6,3) not null,
  geom            geography(Point,4326) generated always as
                    (st_setsrid(st_makepoint(grid_lon::double precision, grid_lat::double precision), 4326)::geography) stored,
  station_id      text,                       -- tidal only: resolved station
  horizon_end     timestamptz,                -- latest ETA any linked passage needs
  next_fetch_at   timestamptz not null default now(),
  last_fetched_at timestamptz,
  last_init_time  timestamptz,
  last_error      text,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (layer, grid_lat, grid_lon)
);
create index ingest_targets_due_idx on ingest_targets (layer, next_fetch_at) where active;
create index ingest_targets_geom_idx on ingest_targets using gist (geom);

create table passage_ingest_targets (
  passage_id uuid   not null references passages(id) on delete cascade,
  target_id  bigint not null references ingest_targets(id) on delete cascade,
  primary key (passage_id, target_id)
);

-- Nearest active target for a layer. Used by compute-conditions.
create or replace function nearest_target(p_layer text, p_geom geography)
returns bigint language sql stable as $$
  select id from ingest_targets
  where layer = p_layer and active
  order by geom <-> p_geom
  limit 1
$$;

-- -----------------------------------------------------------------------------
-- 5. Forecast caches (Feature 3, Feature 11)
-- -----------------------------------------------------------------------------

-- One table for every atmospheric model. Ensemble rows carry percentiles
-- computed by the adapter from raw members; deterministic rows (the GFS
-- comparison layer) carry the single value in p50 with p10 = p90 = p50.
create table forecast_atmospheric (
  id                   bigint generated always as identity primary key,
  target_id            bigint not null references ingest_targets(id) on delete cascade,
  source               text not null,   -- 'google_weathernext2_ensemble' | 'ecmwf_ifs025_ensemble' | 'ncep_gfs_global' | 'weathernext3' (v2)
  kind                 text not null check (kind in ('ensemble','deterministic')),
  init_time            timestamptz not null,
  forecast_time        timestamptz not null,
  lead_time_hours      numeric(6,1) generated always as
                         (extract(epoch from (forecast_time - init_time)) / 3600.0) stored,
  member_count         int,
  wind_p10_kn          numeric(5,1),
  wind_p50_kn          numeric(5,1),
  wind_p90_kn          numeric(5,1),
  wind_dir_mean_deg    numeric(5,1),   -- circular mean of members
  wind_dir_spread_deg  numeric(5,1),   -- circular std dev of members; 0 for deterministic
  gust_p50_kn          numeric(5,1),
  gust_p90_kn          numeric(5,1),
  precip_prob_pct      numeric(5,1),   -- share of members with precip > 0.1 mm
  precip_p50_mm        numeric(6,2),
  mslp_p10_hpa         numeric(6,1),
  mslp_p50_hpa         numeric(6,1),
  mslp_p90_hpa         numeric(6,1),
  cape_p50_jkg         numeric(7,1),
  visibility_p50_m     numeric(8,0),
  temp_p50_c           numeric(4,1),
  wind_members_kn      real[],         -- raw members, kept for the latest init only
  wind_dir_members_deg real[],
  fetched_at           timestamptz not null default now(),
  unique (target_id, source, init_time, forecast_time)
);
create index forecast_atmospheric_lookup_idx on forecast_atmospheric (target_id, source, forecast_time, init_time desc);
create index forecast_atmospheric_init_idx on forecast_atmospheric (init_time);

-- Feature 11 as a view: latest ensemble median vs latest deterministic value
-- per target and forecast hour, with deltas. Thresholds are applied in the
-- compute step from app_settings so they stay tunable.
create view forecast_comparison as
with latest as (
  select distinct on (target_id, source, forecast_time) *
  from forecast_atmospheric
  order by target_id, source, forecast_time, init_time desc
)
select
  p.target_id,
  p.forecast_time,
  p.source              as primary_source,
  p.init_time           as primary_init_time,
  p.wind_p10_kn         as primary_wind_p10_kn,
  p.wind_p50_kn         as primary_wind_p50_kn,
  p.wind_p90_kn         as primary_wind_p90_kn,
  p.wind_dir_mean_deg   as primary_wind_dir_deg,
  c.source              as comparison_source,
  c.init_time           as comparison_init_time,
  c.wind_p50_kn         as comparison_wind_kn,
  c.wind_dir_mean_deg   as comparison_wind_dir_deg,
  abs(p.wind_p50_kn - c.wind_p50_kn)                         as wind_speed_delta_kn,
  angular_delta_deg(p.wind_dir_mean_deg, c.wind_dir_mean_deg) as wind_dir_delta_deg
from latest p
join latest c
  on c.target_id = p.target_id
 and c.forecast_time = p.forecast_time
 and c.kind = 'deterministic'
where p.kind = 'ensemble';

create table forecast_marine (
  id                 bigint generated always as identity primary key,
  target_id          bigint not null references ingest_targets(id) on delete cascade,
  source             text not null default 'open-meteo-marine',
  init_time          timestamptz not null,
  forecast_time      timestamptz not null,
  lead_time_hours    numeric(6,1) generated always as
                       (extract(epoch from (forecast_time - init_time)) / 3600.0) stored,
  wave_height_m      numeric(5,2),   -- significant wave height
  wave_dir_deg       numeric(5,1),
  wave_period_s      numeric(5,1),
  wind_wave_height_m numeric(5,2),
  swell_height_m     numeric(5,2),
  swell_dir_deg      numeric(5,1),
  swell_period_s     numeric(5,1),
  sea_level_msl_m    numeric(5,2),   -- MODEL surface height vs MSL. NOT tide height above chart datum. Never display as tide.
  current_speed_kn   numeric(4,2),
  current_dir_deg    numeric(5,1),   -- direction current flows TOWARD (oceanographic convention)
  sst_c              numeric(4,1),
  fetched_at         timestamptz not null default now(),
  unique (target_id, source, init_time, forecast_time)
);
create index forecast_marine_lookup_idx on forecast_marine (target_id, forecast_time, init_time desc);
create index forecast_marine_init_idx on forecast_marine (init_time);

-- Tide predictions are harmonic, not model runs: no init_time. Keyed on station.
create table forecast_tidal (
  id                  bigint generated always as identity primary key,
  target_id           bigint not null references ingest_targets(id) on delete cascade,
  source              text not null,            -- 'tidesatlas' | 'worldtides'
  station_id          text not null,
  station_name        text,
  station_distance_km numeric(6,1),
  datum               text not null default 'CD' check (datum in ('CD','LAT','MSL','MLLW','unknown')),
  forecast_time       timestamptz not null,
  tide_height_m       numeric(5,2),
  tide_state          text check (tide_state in ('flood','ebb','high','low','slack')),
  fetched_at          timestamptz not null default now(),
  unique (target_id, source, station_id, forecast_time)
);
create index forecast_tidal_lookup_idx on forecast_tidal (target_id, forecast_time);

-- -----------------------------------------------------------------------------
-- 6. Chart features (Feature 7 view-only; Feature 8 reserved)
-- -----------------------------------------------------------------------------

create table chart_features (
  id           bigint generated always as identity primary key,
  source       text not null check (source in ('noaa-enc','openseamap','manual')),
  cell_id      text,                          -- ENC cell name, e.g. US5FL11M
  feature_type text not null,                 -- S-57 object class: DEPARE, SOUNDG, OBSTRN, WRECKS, ...
  geom         geography(Geometry,4326) not null,
  depth_m      numeric(6,1),
  properties   jsonb,
  fetched_at   timestamptz not null default now()
);
create index chart_features_geom_idx on chart_features using gist (geom);
create index chart_features_type_idx on chart_features (source, feature_type);

-- -----------------------------------------------------------------------------
-- 7. Conditions runs (Feature 4 + Feature 12)
--    Every join is a run. Re-checks point at the run they supersede so the
--    diff is run N vs run N-1, never a guess from timestamps.
-- -----------------------------------------------------------------------------

create table conditions_runs (
  id                  uuid primary key default gen_random_uuid(),
  passage_id          uuid not null references passages(id) on delete cascade,
  kind                text not null check (kind in ('initial','recheck')),
  status              text not null default 'pending'
                      check (status in ('pending','running','complete','failed')),
  previous_run_id     uuid references conditions_runs(id),
  sources_used        jsonb,                  -- {"atmospheric": {"source":..., "init_time":...}, ...}
  waypoints_evaluated int,
  error               text,
  created_at          timestamptz not null default now(),
  completed_at        timestamptz
);
create index conditions_runs_passage_idx on conditions_runs (passage_id, created_at desc);

create table waypoint_conditions (
  id                    bigint generated always as identity primary key,
  run_id                uuid not null references conditions_runs(id) on delete cascade,
  waypoint_id           uuid not null references waypoints(id) on delete cascade,
  eta                   timestamptz not null,
  lead_time_hours       numeric(6,1),
  -- atmospheric (primary ensemble)
  atmos_source          text,
  atmos_init_time       timestamptz,
  atmos_forecast_time   timestamptz,
  wind_p10_kn           numeric(5,1),
  wind_p50_kn           numeric(5,1),
  wind_p90_kn           numeric(5,1),
  wind_dir_mean_deg     numeric(5,1),
  wind_dir_spread_deg   numeric(5,1),
  gust_p90_kn           numeric(5,1),
  precip_prob_pct       numeric(5,1),
  visibility_p50_m      numeric(8,0),
  mslp_p50_hpa          numeric(6,1),
  -- marine (deterministic in v1)
  marine_source         text,
  marine_init_time      timestamptz,
  wave_height_m         numeric(5,2),
  wave_dir_deg          numeric(5,1),
  wave_period_s         numeric(5,1),
  swell_height_m        numeric(5,2),
  swell_dir_deg         numeric(5,1),
  swell_period_s        numeric(5,1),
  current_speed_kn      numeric(4,2),
  current_dir_deg       numeric(5,1),
  -- tidal
  tidal_source          text,
  tide_station_id       text,
  tide_height_m         numeric(5,2),
  tide_datum            text,
  tide_state            text,
  -- comparison (Feature 11)
  comparison_source     text,
  comparison_wind_kn    numeric(5,1),
  comparison_wind_dir_deg numeric(5,1),
  wind_speed_delta_kn   numeric(5,1),
  wind_dir_delta_deg    numeric(5,1),
  source_disagreement   boolean not null default false,
  disagreement_detail   jsonb,
  -- under-keel clearance (PRD §13.6)
  charted_depth_m       numeric(6,1),
  ukc_estimate_m        numeric(6,2),
  ukc_basis             text check (ukc_basis in ('charted+tide+swell','charted+tide','none')),
  -- reserved for Feature 8
  hazard_flags          jsonb,
  -- governance + verdict
  confidence_triggers   jsonb not null default '[]'::jsonb,   -- ["lead_time_gt_120h","complex_coastal",...]
  confidence_level      text not null default 'moderate' check (confidence_level in ('high','moderate','low')),
  risk_flag             text not null default 'unknown' check (risk_flag in ('green','amber','red','unknown')),
  risk_reasons          jsonb not null default '[]'::jsonb,   -- ["wind_p90 32kn > 0.75*max_wind 35kn", ...]
  computed_at           timestamptz not null default now(),
  unique (run_id, waypoint_id)
);
create index waypoint_conditions_waypoint_idx on waypoint_conditions (waypoint_id, computed_at desc);

create table anchorage_conditions (
  id                        bigint generated always as identity primary key,
  run_id                    uuid not null references conditions_runs(id) on delete cascade,
  waypoint_id               uuid not null references waypoints(id) on delete cascade,
  stay_start                timestamptz not null,
  stay_end                  timestamptz not null,
  hours_evaluated           int,
  wind_p50_kn               numeric(5,1),   -- median of hourly p50 across the window
  wind_max_p90_kn           numeric(5,1),   -- worst hourly p90 across the window
  gust_max_p90_kn           numeric(5,1),
  wind_dir_predominant_deg  numeric(5,1),
  wind_dir_range_deg        numeric(5,1),   -- how much the wind is expected to veer/back during the stay
  wave_max_m                numeric(5,2),
  swell_max_m               numeric(5,2),
  swell_dir_predominant_deg numeric(5,1),
  tide_min_m                numeric(5,2),
  tide_max_m                numeric(5,2),
  tide_range_m              numeric(5,2),
  min_ukc_estimate_m        numeric(6,2),
  exposure_tag              text,           -- copied from waypoints.anchorage_exposure_tag at compute time
  shelter_exposure          jsonb,          -- v2: computed from coastline geometry
  seabed_type               text,           -- v2: from ENC/OpenSeaMap
  confidence_triggers       jsonb not null default '[]'::jsonb,
  confidence_level          text not null default 'moderate' check (confidence_level in ('high','moderate','low')),
  risk_flag                 text not null default 'unknown' check (risk_flag in ('green','amber','red','unknown')),
  risk_reasons              jsonb not null default '[]'::jsonb,
  computed_at               timestamptz not null default now(),
  unique (run_id, waypoint_id),
  check (stay_end > stay_start)
);

-- -----------------------------------------------------------------------------
-- 8. Briefings (Feature 5, Feature 12)
-- -----------------------------------------------------------------------------

create table passage_briefings (
  id                          uuid primary key default gen_random_uuid(),
  passage_id                  uuid not null references passages(id) on delete cascade,
  run_id                      uuid not null references conditions_runs(id) on delete cascade,
  scope                       text not null default 'full' check (scope in ('full','remaining')),
  summary_text                text,
  recommended_action          text,
  suggested_departure_windows jsonb,          -- [{"start":..., "end":..., "reason":...}]
  confidence_level            text not null check (confidence_level in ('high','moderate','low')),
  confidence_triggers         jsonb not null default '[]'::jsonb,
  disagreement_notes          text,
  material_changes            jsonb,          -- recheck only: [{"waypoint_id":..., "field":..., "from":..., "to":...}]
  is_recheck                  boolean not null default false,
  superseded_by               uuid references passage_briefings(id),
  model_used                  text not null,
  prompt_version              text not null,
  input_snapshot              jsonb not null,  -- exact structured input sent to the model
  input_hash                  text not null,   -- sha256 of input_snapshot; same inputs, different output is detectable
  validator_result            jsonb,           -- {"passed": true, "violations": [], "attempts": 1}
  validator_passed            boolean not null default false,
  generated_at                timestamptz not null default now()
);
create index passage_briefings_passage_idx on passage_briefings (passage_id, generated_at desc);

-- -----------------------------------------------------------------------------
-- 9. Retention
-- -----------------------------------------------------------------------------

create or replace function purge_forecast_cache()
returns table (atmospheric_deleted bigint, marine_deleted bigint, tidal_deleted bigint)
language plpgsql security definer set search_path = public as $$
declare
  keep_days int := coalesce((select (value)::int from app_settings where key = 'cache_retention_days'), 3);
  a bigint; m bigint; t bigint;
begin
  delete from forecast_atmospheric where init_time < now() - make_interval(days => keep_days);
  get diagnostics a = row_count;
  delete from forecast_marine where init_time < now() - make_interval(days => keep_days);
  get diagnostics m = row_count;
  delete from forecast_tidal where forecast_time < now() - make_interval(days => keep_days);
  get diagnostics t = row_count;
  -- drop raw members from anything that is no longer the latest init
  update forecast_atmospheric f set wind_members_kn = null, wind_dir_members_deg = null
  where wind_members_kn is not null
    and init_time < (select max(init_time) from forecast_atmospheric g
                     where g.target_id = f.target_id and g.source = f.source);
  return query select a, m, t;
end $$;

-- -----------------------------------------------------------------------------
-- 10. Row Level Security
--     Owner-scoped user tables. Caches are readable by any signed-in user and
--     written only by the service role (which bypasses RLS).
-- -----------------------------------------------------------------------------

-- Owner check shared by every passage-scoped RLS policy.
create or replace function owns_passage(p_passage_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from passages p
    where p.id = p_passage_id and p.owner_id = auth.uid()
  )
$$;

alter table vessels               enable row level security;
alter table passages              enable row level security;
alter table waypoints             enable row level security;
alter table conditions_runs       enable row level security;
alter table waypoint_conditions   enable row level security;
alter table anchorage_conditions  enable row level security;
alter table passage_briefings     enable row level security;
alter table passage_ingest_targets enable row level security;
alter table ingest_targets        enable row level security;
alter table forecast_atmospheric  enable row level security;
alter table forecast_marine       enable row level security;
alter table forecast_tidal        enable row level security;
alter table chart_features        enable row level security;
alter table app_settings          enable row level security;

-- Supabase grants these by default; stated explicitly so the intent is in the migration.
grant usage on schema public to authenticated, service_role;
grant select on all tables in schema public to authenticated;
grant insert, update, delete on vessels, passages, waypoints, conditions_runs to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

create policy vessels_owner on vessels
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy passages_owner on passages
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy waypoints_owner on waypoints
  for all to authenticated using (owns_passage(passage_id)) with check (owns_passage(passage_id));

create policy conditions_runs_owner on conditions_runs
  for all to authenticated using (owns_passage(passage_id)) with check (owns_passage(passage_id));

create policy waypoint_conditions_owner on waypoint_conditions
  for select to authenticated
  using (exists (select 1 from conditions_runs r where r.id = run_id and owns_passage(r.passage_id)));

create policy anchorage_conditions_owner on anchorage_conditions
  for select to authenticated
  using (exists (select 1 from conditions_runs r where r.id = run_id and owns_passage(r.passage_id)));

create policy passage_briefings_owner on passage_briefings
  for select to authenticated using (owns_passage(passage_id));

create policy passage_ingest_targets_owner on passage_ingest_targets
  for select to authenticated using (owns_passage(passage_id));

create policy ingest_targets_read       on ingest_targets       for select to authenticated using (true);
create policy forecast_atmospheric_read on forecast_atmospheric for select to authenticated using (true);
create policy forecast_marine_read      on forecast_marine      for select to authenticated using (true);
create policy forecast_tidal_read       on forecast_tidal       for select to authenticated using (true);
create policy chart_features_read       on chart_features       for select to authenticated using (true);
create policy app_settings_read         on app_settings         for select to authenticated using (true);

-- -----------------------------------------------------------------------------
-- 11. Scheduling — SUPABASE ONLY (pg_cron + pg_net). Skipped elsewhere.
--
--     Four jobs hit ONE edge function (ingest-tick) with a layer parameter.
--     The function returns immediately and does its work in
--     EdgeRuntime.waitUntil(), processing one batch of due ingest_targets.
--     pg_net is fire-and-forget with a 5 s cap, so nothing here waits.
--
--     Before running on Supabase:
--       1. Dashboard → Integrations → enable pg_cron and pg_net.
--       2. Store secrets in Vault:
--            select vault.create_secret('https://<project-ref>.supabase.co/functions/v1', 'functions_url');
--            select vault.create_secret('<long-random-string>', 'cron_secret');
--          The edge function rejects any request whose x-cron-secret header
--          does not match CRON_SECRET in its own env.
-- -----------------------------------------------------------------------------

do $cron$
declare
  base_url text;
  secret   text;
  job      record;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
     or not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise notice 'pg_cron/pg_net not installed: skipping schedule block (expected outside Supabase)';
    return;
  end if;

  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'functions_url';
  select decrypted_secret into secret   from vault.decrypted_secrets where name = 'cron_secret';
  if base_url is null or secret is null then
    raise notice 'vault secrets functions_url/cron_secret missing: skipping schedule block';
    return;
  end if;

  for job in
    select * from (values
      ('ingest-tick-atmospheric', '*/15 * * * *', 'atmospheric'),
      ('ingest-tick-comparison',  '*/15 * * * *', 'comparison'),
      ('ingest-tick-marine',      '*/15 * * * *', 'marine'),
      ('ingest-tick-tidal',       '10 2 * * *',   'tidal')
    ) as j(name, schedule, layer)
  loop
    perform cron.unschedule(job.name) where exists (select 1 from cron.job where jobname = job.name);
    perform cron.schedule(
      job.name,
      job.schedule,
      format(
        $q$select net.http_post(
             url := %L,
             headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',%L),
             body := jsonb_build_object('layer', %L, 'trigger', 'scheduled'),
             timeout_milliseconds := 5000)$q$,
        base_url || '/ingest-tick', secret, job.layer)
    );
  end loop;

  perform cron.unschedule('purge-forecast-cache') where exists (select 1 from cron.job where jobname = 'purge-forecast-cache');
  perform cron.schedule('purge-forecast-cache', '30 3 * * *', 'select public.purge_forecast_cache()');
end $cron$;
