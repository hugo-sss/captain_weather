-- =============================================================================
-- 0002: security hardening. Additive only; addresses Supabase advisor findings
-- observed after applying 0001 on project jyhaavppeilbxzikuhfg (2026-09-04).
--
--   * forecast_comparison was SECURITY DEFINER by Postgres default, which would
--     bypass RLS on forecast_atmospheric for the querying user. Caches are
--     readable by any signed-in user anyway, but the view must not be a
--     precedent: run it as the invoker.
--   * Helper functions get a pinned search_path (nearest_target needs
--     `extensions` on Supabase because PostGIS lives there).
--   * owns_passage() is SECURITY DEFINER for RLS use only: keep EXECUTE for
--     authenticated (policies evaluate as the querying role) and revoke anon.
--   * purge_forecast_cache() runs from pg_cron as postgres; nobody else needs it.
-- =============================================================================

alter view public.forecast_comparison set (security_invoker = true);

alter function public.set_updated_at() set search_path = public;
alter function public.angular_delta_deg(numeric, numeric) set search_path = public;
alter function public.nearest_target(text, geography) set search_path = public, extensions;

revoke execute on function public.owns_passage(uuid) from public, anon;
grant  execute on function public.owns_passage(uuid) to authenticated, service_role;

revoke execute on function public.purge_forecast_cache() from public, anon, authenticated;
grant  execute on function public.purge_forecast_cache() to service_role;
