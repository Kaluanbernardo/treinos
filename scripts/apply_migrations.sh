#!/usr/bin/env bash
# Aplica supabase/migrations/*.sql em ordem (registrando em public._migrations) e depois o seed.
# Uso: scripts/apply_migrations.sh [--no-seed]
# Conexão: $SUPABASE_DB_URL ou $SECRETS_DIR/fitness_db_url (nunca impressa).
set -euo pipefail
source "$(dirname "$0")/lib.sh"
load_db_url

SEED=1
[[ "${1:-}" == "--no-seed" ]] && SEED=0

run_psql <<'SQL'
create table if not exists public._migrations (
  version     text primary key,
  name        text not null,
  checksum    text not null,
  applied_at  timestamptz not null default now()
);
alter table public._migrations enable row level security;
revoke all on public._migrations from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on public._migrations from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then revoke all on public._migrations from authenticated; end if;
end $$;
SQL

applied=0
for f in "$REPO_ROOT"/supabase/migrations/*.sql; do
  base="$(basename "$f")"
  version="${base%%_*}"
  sum="$(sha256sum "$f" | cut -d' ' -f1)"
  existing="$(run_psql -At -v v="$version" <<'SQL'
select checksum from public._migrations where version = :'v';
SQL
)"
  if [[ -n "$existing" ]]; then
    [[ "$existing" == "$sum" ]] || echo "aviso: $base mudou depois de aplicada (checksum diferente); não reaplicada" >&2
    continue
  fi
  echo "aplicando $base"
  # migration + registro na mesma transação
  run_psql -v f="$f" -v v="$version" -v n="$base" -v s="$sum" >/dev/null <<'SQL'
begin;
set local client_min_messages = warning;
\i :f
insert into public._migrations (version, name, checksum) values (:'v', :'n', :'s');
commit;
SQL
  applied=$((applied + 1))
done
echo "migrations novas: $applied"

if [[ $SEED -eq 1 ]]; then
  echo "aplicando seed.sql"
  PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning" run_psql -f "$REPO_ROOT/supabase/seed.sql" >/dev/null
fi
echo "ok"
