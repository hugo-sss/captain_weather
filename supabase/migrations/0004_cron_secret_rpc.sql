-- =============================================================================
-- 0004: cron_secret() for the service role.
-- PRD §11 has pg_cron send x-cron-secret from Vault and ingest-tick compare it
-- with CRON_SECRET in its own env. Edge-function secrets cannot be set from
-- SQL or the MCP tooling, so ingest-tick also accepts the Vault value read
-- through this function (service role only). Env CRON_SECRET still wins when
-- present. Additive; nothing in 0001–0003 changes. Skipped where Vault is
-- absent (plain Postgres), like the cron block in 0001.
-- =============================================================================
do $$
begin
  if to_regclass('vault.decrypted_secrets') is null then
    raise notice 'vault not installed: skipping cron_secret() (expected outside Supabase)';
    return;
  end if;
  execute $f$
    create or replace function public.cron_secret()
    returns text language sql stable security definer set search_path = public, vault as $q$
      select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1
    $q$
  $f$;
  execute 'revoke execute on function public.cron_secret() from public, anon, authenticated';
  execute 'grant execute on function public.cron_secret() to service_role';
end $$;
