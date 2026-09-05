-- =============================================================================
-- 0005: chart_features_geojson(bbox) for the NOAA ENC overlay (Feature 7).
-- Read-only helper over chart_features; runs as the caller so the
-- chart_features_read policy applies. Additive.
-- =============================================================================
create or replace function public.chart_features_geojson(min_lon double precision, min_lat double precision, max_lon double precision, max_lat double precision, max_rows int default 4000)
returns jsonb language sql stable security invoker set search_path = public, extensions as $$
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(jsonb_agg(jsonb_build_object(
      'type', 'Feature',
      'geometry', st_asgeojson(f.geom)::jsonb,
      'properties', jsonb_build_object('id', f.id, 'source', f.source, 'cell_id', f.cell_id, 'feature_type', f.feature_type, 'depth_m', f.depth_m)
    )), '[]'::jsonb)
  )
  from (
    select id, source, cell_id, feature_type, geom, depth_m
    from chart_features
    where geom && st_makeenvelope(min_lon, min_lat, max_lon, max_lat, 4326)::geography
    order by case feature_type when 'DEPARE' then 0 when 'DEPCNT' then 1 when 'OBSTRN' then 2 when 'WRECKS' then 2 when 'LIGHTS' then 3 else 4 end, id
    limit greatest(1, least(max_rows, 10000))
  ) f
$$;
grant execute on function public.chart_features_geojson(double precision, double precision, double precision, double precision, int) to authenticated, service_role;
revoke execute on function public.chart_features_geojson(double precision, double precision, double precision, double precision, int) from public, anon;
