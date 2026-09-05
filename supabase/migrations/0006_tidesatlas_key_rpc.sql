-- =============================================================================
-- 0006: tidesatlas_api_key() from Vault, service role only.
-- Edge-function env secrets cannot be set from SQL or the MCP tooling, so
-- ingest-tick reads TIDESATLAS_API_KEY from its env when set and otherwise the
-- Vault secret via this function. Mirrors 0004 cron_secret(). Additive; skipped
-- where Vault is absent (plain Postgres), like the cron block in 0001.
-- =============================================================================
do $$
begin
  if to_regclass('vault.decrypted_secrets') is null then
    raise notice 'vault not installed: skipping tidesatlas_api_key() (expected outside Supabase)';
    return;
  end if;
  execute $f$
    create or replace function public.tidesatlas_api_key()
    returns text language sql stable security definer set search_path = public, vault as $q$
      select decrypted_secret from vault.decrypted_secrets where name = 'tidesatlas_api_key' limit 1
    $q$
  $f$;
  execute 'revoke execute on function public.tidesatlas_api_key() from public, anon, authenticated';
  execute 'grant execute on function public.tidesatlas_api_key() to service_role';
end $$;
