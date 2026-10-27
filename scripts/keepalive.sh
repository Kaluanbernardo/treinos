#!/usr/bin/env bash
# Keepalive diário (o Supabase free pausa após ~7 dias sem atividade).
# 1) select 1 com a URL do bot ($SECRETS_DIR/fitness_bot_db_url);
# 2) se falhar, ping REST em $SUPABASE_URL com a anon key ($VITE_SUPABASE_ANON_KEY ou
#    $SECRETS_DIR/fitness_anon_key).
# Log: $BACKUP_DIR/keepalive.log. Sai != 0 se as duas falharem.
set -uo pipefail
source "$(dirname "$0")/lib.sh"
BOT_URL_FILE="${BOT_URL_FILE:-$SECRETS_DIR/fitness_bot_db_url}"
LOG="$BACKUP_DIR/keepalive.log"
( umask 077; mkdir -p "$BACKUP_DIR" )
log() { printf '%s %s\n' "$(date -Iseconds)" "$*" >> "$LOG"; }

if [[ -r "$BOT_URL_FILE" ]]; then
  if r="$(PGCONNECT_TIMEOUT=15 psql "$(tr -d '\r\n' < "$BOT_URL_FILE")" -X -At -c 'select 1' 2>&1)" && [[ "$r" == 1 ]]; then
    log "ok sql"; exit 0
  fi
  log "falha sql: $(printf '%s' "$r" | head -1 | cut -c1-200)"
else
  log "sem $BOT_URL_FILE; tentando REST"
fi

anon="${VITE_SUPABASE_ANON_KEY:-}"
[[ -z "$anon" && -r "$SECRETS_DIR/fitness_anon_key" ]] && anon="$(tr -d '\r\n' < "$SECRETS_DIR/fitness_anon_key")"
if [[ -n "$anon" ]]; then
  h="$(mktemp)"; trap 'rm -f "$h"' EXIT
  printf 'apikey: %s\nAuthorization: Bearer %s\n' "$anon" "$anon" > "$h"
  # anon não tem acesso às tabelas (resposta 401/403/404 é esperada), mas a requisição passa pelo PostgREST/banco
  code="$(curl -sS -m 20 -o /dev/null -w '%{http_code}' -H @"$h" "$SUPABASE_URL/rest/v1/exercises?select=id&limit=1" 2>/dev/null || echo 000)"
  if [[ "$code" != 000 && "$code" != 5* ]]; then log "ok rest http=$code"; exit 0; fi
  log "falha rest http=$code"
else
  log "falha: sem anon key para o ping REST"
fi
exit 1
