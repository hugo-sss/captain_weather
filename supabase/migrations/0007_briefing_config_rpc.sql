-- Briefing backend config for generate-briefing, supplied without edge-function
-- env secrets (which cannot be set through the MCP tooling). The Synthetic /
-- OpenAI-compatible API key lives in Vault; the non-secret provider, base URL
-- and model live in app_settings so they are tunable without a redeploy.
-- SECURITY DEFINER + service_role only, mirroring cron_secret() and
-- tidesatlas_api_key(). Guarded so it is a no-op on a plain Postgres instance.
do $$
begin
  if to_regclass('vault.decrypted_secrets') is null then
    raise notice 'vault not installed: skipping briefing_config()';
    return;
  end if;
  execute $f$
    create or replace function public.briefing_config()
    returns jsonb language sql stable security definer set search_path = public, vault as $q$
      select jsonb_build_object(
        'api_key', (select decrypted_secret from vault.decrypted_secrets where name = 'briefing_api_key' limit 1),
        'settings', (select value from public.app_settings where key = 'briefing' limit 1)
      )
    $q$
  $f$;
  execute 'revoke execute on function public.briefing_config() from public, anon, authenticated';
  execute 'grant execute on function public.briefing_config() to service_role';
end $$;
