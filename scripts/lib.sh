# shellcheck shell=bash
# Funções comuns. Nenhuma delas imprime URLs, senhas ou chaves.

SECRETS_DIR="${SECRETS_DIR:-/home/box/.secrets}"
BACKUP_DIR="${BACKUP_DIR:-/home/box/backups/fitness}"
SUPABASE_URL="${SUPABASE_URL:-https://qlphmxjehsexuxspspaw.supabase.co}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

die() { echo "erro: $*" >&2; exit 1; }

# Define DB_URL a partir de $SUPABASE_DB_URL ou do arquivo $SECRETS_DIR/fitness_db_url.
load_db_url() {
  if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
    DB_URL="$SUPABASE_DB_URL"
  elif [[ -r "$SECRETS_DIR/fitness_db_url" ]]; then
    DB_URL="$(tr -d '\r\n' < "$SECRETS_DIR/fitness_db_url")"
  else
    die "defina SUPABASE_DB_URL ou crie $SECRETS_DIR/fitness_db_url (chmod 600)"
  fi
  [[ -n "$DB_URL" ]] || die "connection string vazia"
}

# psql silencioso, para em erro, sem ler ~/.psqlrc.
run_psql() { psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }

write_secret() { # write_secret <arquivo>  (conteúdo via stdin)
  local f="$1"
  ( umask 077; mkdir -p "$(dirname "$f")"; cat > "$f" )
  chmod 600 "$f"
}

# bot_url <url admin> <senha>: mesma URL com usuário `bot` (ou `bot.<project_ref>` no pooler).
bot_url() {
  local re='^(postgres(ql)?://)([^:@/]+)(:[^@]*)?@([^/?]*)(/[^?]*)?(\?.*)?$'
  [[ "$1" =~ $re ]] || die "formato de connection string não reconhecido (esperado postgresql://user:senha@host:porta/db)"
  local scheme="${BASH_REMATCH[1]}" user="${BASH_REMATCH[3]}" hostport="${BASH_REMATCH[5]}"
  local path="${BASH_REMATCH[6]:-/postgres}" query="${BASH_REMATCH[7]:-}" bot_user=bot
  [[ "$user" =~ ^[^.]+\.(.+)$ ]] && bot_user="bot.${BASH_REMATCH[1]}"   # Supavisor: user.<project_ref>
  if [[ -z "$query" && ( "$hostport" == *supabase.co* || "$hostport" == *supabase.com* ) ]]; then
    query="?sslmode=require"
  fi
  printf '%s%s:%s@%s%s%s\n' "$scheme" "$bot_user" "$2" "$hostport" "$path" "$query"
}
