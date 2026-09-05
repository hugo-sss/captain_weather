-- Phase 5 e-mail alerts. recheck-tick sends a Resend e-mail for material-change
-- and first-briefing notifications when app_settings.alerts.email is set AND a
-- Resend key is available. The key lives in Vault under the name
-- 'resend_api_key' and is read through this SECURITY DEFINER, service_role-only
-- RPC (same pattern as cron_secret(), tidesatlas_api_key(), briefing_config()).
-- Returns null when the secret is absent, so the function degrades to in-app
-- notifications only. Guarded so it is a no-op on a plain Postgres instance.
--
-- To enable e-mail:
--   select vault.create_secret('re_xxx', 'resend_api_key', 'Resend API key for alerts');
--   update app_settings set value = '{"email": "captain@example.com"}' where key = 'alerts';
do $$
begin
  if to_regclass('vault.decrypted_secrets') is null then
    raise notice 'vault not installed: skipping resend_api_key()';
    return;
  end if;
  execute $f$
    create or replace function public.resend_api_key()
    returns text language sql stable security definer set search_path = public, vault as $q$
      select decrypted_secret from vault.decrypted_secrets where name = 'resend_api_key' limit 1
    $q$
  $f$;
  execute 'revoke execute on function public.resend_api_key() from public, anon, authenticated';
  execute 'grant execute on function public.resend_api_key() to service_role';
end $$;
