#!/usr/bin/env bash
# Cria o usuário de login (e-mail + senha temporária) pela Admin API do Supabase Auth e
# registra o UUID como dono (app_config.owner_uuid).
#   Uso: SUPABASE_SERVICE_ROLE_KEY=... scripts/create_login_user.sh [email]  (padrão: kaluanbernardo@gmail.com)
#   (a chave também pode vir de $SECRETS_DIR/fitness_service_role_key)
# Senha temporária → $SECRETS_DIR/fitness_login_password (chmod 600). Troque no 1º uso.
# Fallback sem service role key: crie o usuário no Dashboard (Authentication > Users > Add user,
# "Auto Confirm User") e rode scripts/set_owner.sh <uuid>.
set -euo pipefail
umask 077
source "$(dirname "$0")/lib.sh"
email="${1:-kaluanbernardo@gmail.com}"
[[ "$email" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]] || die "uso: $0 [email]"

key="${SUPABASE_SERVICE_ROLE_KEY:-}"
if [[ -z "$key" && -r "$SECRETS_DIR/fitness_service_role_key" ]]; then
  key="$(tr -d '\r\n' < "$SECRETS_DIR/fitness_service_role_key")"
fi
[[ -n "$key" ]] || die "defina SUPABASE_SERVICE_ROLE_KEY (ou use o fallback do Dashboard + set_owner.sh)"

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
chmod 700 "$tmp"
pw="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)"

# cabeçalhos e corpo em arquivos (a chave e a senha não vão para argv/ps)
printf 'apikey: %s\nAuthorization: Bearer %s\nContent-Type: application/json\n' "$key" "$key" > "$tmp/h"
python3 -c 'import json,sys; print(json.dumps({"email": sys.argv[1], "password": sys.stdin.read().strip(), "email_confirm": True}))' \
  "$email" <<<"$pw" > "$tmp/body"

code="$(curl -sS -o "$tmp/resp" -w '%{http_code}' -X POST -H @"$tmp/h" --data-binary @"$tmp/body" \
  "$SUPABASE_URL/auth/v1/admin/users")"
if [[ "$code" != 200 && "$code" != 201 ]]; then
  msg="$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(d.get("msg") or d.get("message") or d.get("error_description") or d.get("error") or "")' "$tmp/resp" 2>/dev/null || true)"
  die "Admin API respondeu HTTP $code ${msg:+($msg)}"
fi
uuid="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["id"])' "$tmp/resp")"

printf '%s\n' "$pw" | write_secret "$SECRETS_DIR/fitness_login_password"
unset pw key
echo "usuário criado: $uuid (senha temporária em $SECRETS_DIR/fitness_login_password)"
"$(dirname "$0")/set_owner.sh" "$uuid"
