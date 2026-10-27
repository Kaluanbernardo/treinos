#!/usr/bin/env bash
# Define o dono do app (UUID do usuário em auth.users) em public.app_config.
# Uso: scripts/set_owner.sh <uuid>
set -euo pipefail
source "$(dirname "$0")/lib.sh"
uuid="${1:-}"
[[ "$uuid" =~ ^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$ ]] || die "uso: $0 <uuid do usuário>"
load_db_url

found="$(run_psql -At -v u="$uuid" <<'SQL'
select count(*) from auth.users where id = :'u'::uuid;
SQL
)"
[[ "$found" == "1" ]] || echo "aviso: $uuid não está em auth.users (gravando mesmo assim)" >&2

run_psql -v u="$uuid" >/dev/null <<'SQL'
update public.app_config set owner_uuid = :'u'::uuid, updated_at = now();
SQL
echo "ok"
