#!/usr/bin/env bash
# Apply every migration to a FRESH local Postgres 16 + PostGIS database.
# Stand-in for `supabase db reset` where the Supabase CLI cannot be installed.
# Requires: a local postgres superuser reachable via PG* env or `su postgres`.
set -euo pipefail
DB="${CPT_CHECK_DB:-cpt_check}"
PSQL="${PSQL:-psql -q -v ON_ERROR_STOP=1}"
# Root without an explicit connection: go through the postgres OS user (peer auth).
if [ "$(id -u)" = "0" ] && [ -z "${CPT_PG_DIRECT:-}" ]; then
  run() { su postgres -c "env -u PGHOST -u PGUSER -u PGPASSWORD -u PGDATABASE $PSQL $(printf '%q ' "$@")"; }
else
  run() { $PSQL "$@"; }
fi
run -d postgres -c "drop database if exists $DB" -c "create database $DB"
# Stub of the Supabase auth surface so the migrations run on plain Postgres.
STUB=$(mktemp)
cat > "$STUB" <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
SQL
chmod 644 "$STUB"; run -d "$DB" -f "$STUB"; rm -f "$STUB"
for f in "$(dirname "$0")"/../supabase/migrations/*.sql; do
  echo "applying $(basename "$f")"
  run -d "$DB" -f "$f"
done
run -d "$DB" -c "select count(*) as tables from pg_tables where schemaname='public' and tablename <> 'spatial_ref_sys'" \
             -c "select relname, relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r' and relname <> 'spatial_ref_sys' order by 1"
echo "DB CHECK OK"
