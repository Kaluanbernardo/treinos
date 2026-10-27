#!/usr/bin/env bash
# Gera senha forte para o role `bot`, habilita LOGIN e grava a connection string do bot em
# $SECRETS_DIR/fitness_bot_db_url (chmod 600). Mesmo host/porta/db da URL admin; usuário `bot`
# (ou `bot.<project_ref>` quando a URL é do pooler, usuário `postgres.<project_ref>`).
# Imprime só "ok". Rodar de novo = rotacionar a senha.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
load_db_url
bot_url "$DB_URL" x >/dev/null   # valida o formato antes de mexer no role
OUT="${BOT_URL_FILE:-$SECRETS_DIR/fitness_bot_db_url}"

pw="$(openssl rand -hex 32)"   # 256 bits, só [0-9a-f]: não precisa de URL-encoding

# senha via stdin (não aparece em argv/ps)
printf '\\set pw %s\nalter role bot login password :'"'"'pw'"'"';\n' "$pw" | run_psql >/dev/null

bot_url "$DB_URL" "$pw" | write_secret "$OUT"
unset pw
echo "ok"
