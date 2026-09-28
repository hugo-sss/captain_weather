-- Tidal streams and current-corrected ETAs.
--
-- No API carries real tidal stream data (Admiralty stream atlases are not licensed for
-- APIs, TidesAtlas and WorldTides have no currents endpoint), so:
--   1. A captain can type the stream from the atlas for the leg INTO a waypoint (rate and
--      the direction it sets toward, for the hour they expect to be there). The engine
--      uses it for that leg's speed over ground and ETA. It always beats the model current.
--   2. Where nothing is typed, the engine uses the model surface current (Open-Meteo
--      Marine, Copernicus global ocean, about 9 km) sampled at the leg midpoint. Fair in
--      open water, blind in channels; labelled as such everywhere it shows.
-- The planned ETA (still water, planned speed) is kept alongside so the shift is visible.

alter table waypoints
  add column if not exists stream_rate_kn numeric(5,2) check (stream_rate_kn is null or stream_rate_kn >= 0),
  add column if not exists stream_set_deg numeric(5,1) check (stream_set_deg is null or (stream_set_deg >= 0 and stream_set_deg < 360));
comment on column waypoints.stream_rate_kn is 'Manual tidal stream on the leg into this waypoint, from the atlas. Overrides the model current on that leg.';
comment on column waypoints.stream_set_deg is 'Direction the manual stream sets TOWARD, degrees true.';

alter table waypoint_conditions
  add column if not exists sog_kn numeric(5,2),
  add column if not exists current_applied_kn numeric(5,2),
  add column if not exists current_applied_dir_deg numeric(5,1),
  add column if not exists current_source text check (current_source is null or current_source in ('manual', 'model')),
  add column if not exists current_delta_min integer;
comment on column waypoint_conditions.current_source is 'Which current moved this ETA: manual (typed from the atlas) or model (surface current at the leg midpoint). Null when none was applied.';
comment on column waypoint_conditions.current_delta_min is 'Minutes the applied current moved this arrival versus still water (positive = later).';

insert into app_settings (key, value, description) values
  ('eta', '{"use_model_current": true}', 'Correct ETAs with the model surface current where no manual stream is typed for the leg. Manual streams always apply.')
on conflict (key) do nothing;
