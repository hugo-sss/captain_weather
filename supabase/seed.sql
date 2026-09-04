-- Local seed: one fixture user, one vessel, one 3-leg passage (scripts/fixtures/passage-3leg.csv).
-- Used with `supabase db reset` or scripts/db-check.sh. NOT for the hosted project:
-- there, create the vessel and passage through the UI as the signed-in user.
insert into auth.users (id, email) values ('00000000-0000-4000-8000-000000000001', 'fixture@example.invalid') on conflict (id) do nothing;

insert into vessels (id, owner_id, name, vessel_class, length_m, beam_m, draft_m, cruise_speed_kn, max_wind_kn, max_gust_kn, max_wave_m, max_current_kn, min_ukc_m)
values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001', 'MY Fixture', 'motor', 40, 8.5, 2.4, 9, 30, 40, 2.0, 3, 1.0)
on conflict (id) do nothing;

insert into passages (id, owner_id, vessel_id, name, planned_departure, status)
values ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a1', 'Phuket to Lanta (3 legs)', now() + interval '1 day', 'planned')
on conflict (id) do nothing;

insert into waypoints (passage_id, sequence, name, lat, lon, is_anchorage, planned_departure_from_here, source) values
  ('00000000-0000-4000-8000-0000000000b1', 1, 'Ao Chalong', 7.8167, 98.3500, false, null, 'csv'),
  ('00000000-0000-4000-8000-0000000000b1', 2, 'Racha Yai',  7.6000, 98.3667, false, null, 'csv'),
  ('00000000-0000-4000-8000-0000000000b1', 3, 'Phi Phi Don', 7.7400, 98.7780, true, now() + interval '1 day 20 hours', 'csv'),
  ('00000000-0000-4000-8000-0000000000b1', 4, 'Koh Lanta',  7.5200, 99.0800, false, null, 'csv')
on conflict (passage_id, sequence) do nothing;
