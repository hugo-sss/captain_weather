-- =============================================================================
-- 0003: owns_passage() as SECURITY INVOKER.
-- The RLS policies on waypoints, conditions_runs, waypoint_conditions,
-- anchorage_conditions, passage_briefings and passage_ingest_targets call
-- owns_passage() as the querying role. Reading passages under its own owner
-- policy gives the identical answer, so the function does not need to run as
-- its definer, and the Supabase advisor stops flagging an RPC-exposed
-- SECURITY DEFINER function. Additive; no policy text changes.
-- =============================================================================
alter function public.owns_passage(uuid) security invoker;
