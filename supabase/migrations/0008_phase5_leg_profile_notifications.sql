-- Phase 5: conditions along each leg, gust provenance, squall risk, sea-state
-- speed loss, depth provenance, notifications and the scheduled re-check job.
-- Additive only. Guarded so it also applies on a plain Postgres (no cron/vault).

-- 1. Conditions evaluated at virtual points along each leg (between waypoints).
create table if not exists leg_conditions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references conditions_runs(id) on delete cascade,
  from_waypoint_id uuid not null references waypoints(id) on delete cascade,
  to_waypoint_id uuid not null references waypoints(id) on delete cascade,
  seq integer not null,
  fraction numeric(6,5) not null,
  lat numeric(9,6) not null,
  lon numeric(9,6) not null,
  eta timestamptz not null,
  lead_time_hours numeric(6,1),
  atmos_init_time timestamptz,
  wind_p10_kn numeric(5,1), wind_p50_kn numeric(5,1), wind_p90_kn numeric(5,1),
  wind_dir_mean_deg numeric(5,1), wind_dir_spread_deg numeric(5,1),
  gust_p90_kn numeric(5,1), gust_source text,
  comparison_source text, comparison_wind_kn numeric(5,1), comparison_wind_dir_deg numeric(5,1),
  wind_speed_delta_kn numeric(5,1), wind_dir_delta_deg numeric(5,1),
  source_disagreement boolean not null default false,
  wave_height_m numeric(5,2), wave_dir_deg numeric(5,1), wave_period_s numeric(5,1),
  swell_height_m numeric(5,2), swell_dir_deg numeric(5,1), swell_period_s numeric(5,1),
  current_speed_kn numeric(5,2), current_dir_deg numeric(5,1),
  precip_prob_pct numeric(5,1), cape_p50_jkg numeric(7,1), mslp_p50_hpa numeric(6,1), visibility_p50_m numeric(8,0),
  squall_risk text not null default 'none' check (squall_risk in ('none','possible','likely')),
  speed_loss_pct numeric(5,1),
  risk_flag text not null check (risk_flag in ('green','amber','red','unknown')),
  risk_reasons jsonb not null default '[]'::jsonb,
  confidence_level text not null check (confidence_level in ('high','moderate','low')),
  confidence_triggers jsonb not null default '[]'::jsonb,
  data_gaps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, from_waypoint_id, seq)
);
create index if not exists leg_conditions_run_idx on leg_conditions(run_id);
alter table leg_conditions enable row level security;
drop policy if exists leg_conditions_owner on leg_conditions;
create policy leg_conditions_owner on leg_conditions
  for select to authenticated
  using (exists (select 1 from conditions_runs r where r.id = run_id and owns_passage(r.passage_id)));

-- 2. Waypoint / anchorage conditions gain gust provenance, squall risk and speed loss.
alter table waypoint_conditions
  add column if not exists gust_source text,
  add column if not exists cape_p50_jkg numeric(7,1),
  add column if not exists squall_risk text not null default 'none',
  add column if not exists speed_loss_pct numeric(5,1),
  add column if not exists eta_planned timestamptz;
alter table anchorage_conditions
  add column if not exists squall_risk text not null default 'none';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'waypoint_conditions_squall_check') then
    alter table waypoint_conditions add constraint waypoint_conditions_squall_check check (squall_risk in ('none','possible','likely'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'anchorage_conditions_squall_check') then
    alter table anchorage_conditions add constraint anchorage_conditions_squall_check check (squall_risk in ('none','possible','likely'));
  end if;
end $$;

-- 3. Depth provenance: a GEBCO-suggested depth is never presented as charted.
alter table waypoints
  add column if not exists charted_depth_source text check (charted_depth_source in ('user','gebco'));

-- 4. Runs record what triggered them.
alter table conditions_runs
  add column if not exists trigger text not null default 'manual' check (trigger in ('manual','scheduled'));

-- 5. Notifications (in-app inbox; e-mail is optional and recorded in emailed_at).
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  passage_id uuid references passages(id) on delete cascade,
  run_id uuid references conditions_runs(id) on delete set null,
  briefing_id uuid references passage_briefings(id) on delete set null,
  kind text not null check (kind in ('material_change','recheck','recheck_failed','briefing')),
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  emailed_at timestamptz
);
create index if not exists notifications_owner_idx on notifications(owner_id, created_at desc);
alter table notifications enable row level security;
drop policy if exists notifications_owner_select on notifications;
create policy notifications_owner_select on notifications
  for select to authenticated using (owner_id = auth.uid());
drop policy if exists notifications_owner_update on notifications;
create policy notifications_owner_update on notifications
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 6. Tunable rules for the new behaviour (defaults; the functions fall back to the same values).
insert into app_settings (key, value) values
  ('leg_sampling', '{"hours": 6, "max_points_per_leg": 12}'::jsonb),
  ('speed_loss', '{"head_sector_deg": 45, "beam_sector_deg": 135, "max_loss_pct": 40, "curve": [
      {"hs_m": 0.5, "head_pct": 2,  "beam_pct": 1,  "follow_pct": 0},
      {"hs_m": 1.0, "head_pct": 6,  "beam_pct": 3,  "follow_pct": 1},
      {"hs_m": 1.5, "head_pct": 12, "beam_pct": 6,  "follow_pct": 2},
      {"hs_m": 2.0, "head_pct": 18, "beam_pct": 9,  "follow_pct": 3},
      {"hs_m": 2.5, "head_pct": 25, "beam_pct": 12, "follow_pct": 4},
      {"hs_m": 3.0, "head_pct": 33, "beam_pct": 16, "follow_pct": 5}]}'::jsonb),
  ('squall', '{"likely": {"cape_jkg": 1000, "precip_prob_pct": 40}, "possible": {"cape_jkg": 500, "precip_prob_pct": 30}}'::jsonb),
  ('alerts', '{"email": null}'::jsonb)
on conflict (key) do nothing;

-- 7. Scheduled re-check: hourly at :40, the function decides per passage whether a
--    newer model run has landed. Same Vault pattern as the ingest jobs in 0001.
do $$
declare
  base_url text;
  secret text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
     or not exists (select 1 from pg_extension where extname = 'pg_net')
     or to_regclass('vault.decrypted_secrets') is null then
    raise notice 'pg_cron/pg_net/vault not installed: skipping recheck-tick schedule';
    return;
  end if;
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'functions_url';
  select decrypted_secret into secret   from vault.decrypted_secrets where name = 'cron_secret';
  if base_url is null or secret is null then
    raise notice 'vault secrets functions_url/cron_secret missing: skipping recheck-tick schedule';
    return;
  end if;
  perform cron.unschedule('recheck-tick') where exists (select 1 from cron.job where jobname = 'recheck-tick');
  perform cron.schedule(
    'recheck-tick',
    '40 * * * *',
    format(
      $q$select net.http_post(
           url := %L,
           headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',%L),
           body := jsonb_build_object('trigger', 'scheduled'),
           timeout_milliseconds := 5000)$q$,
      base_url || '/recheck-tick', secret)
  );
end $$;
