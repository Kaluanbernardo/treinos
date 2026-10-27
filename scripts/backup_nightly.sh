#!/usr/bin/env bash
# pg_dump -Fc do schema public para $BACKUP_DIR (padrão /home/box/backups/fitness), retenção de 30 dias.
# Conexão: $SUPABASE_DB_URL ou $SECRETS_DIR/fitness_db_url. Schemas extras: BACKUP_SCHEMAS="public auth".
set -euo pipefail
source "$(dirname "$0")/lib.sh"
load_db_url
RETENTION_DAYS="${RETENTION_DAYS:-30}"
( umask 077; mkdir -p "$BACKUP_DIR" )

args=()
for s in ${BACKUP_SCHEMAS:-public}; do args+=(--schema="$s"); done

out="$BACKUP_DIR/fitness_$(date +%Y%m%d_%H%M%S).dump"
umask 077
pg_dump "$DB_URL" -Fc --no-owner --no-privileges "${args[@]}" -f "$out.partial"
mv "$out.partial" "$out"
find "$BACKUP_DIR" -maxdepth 1 -name 'fitness_*.dump' -type f -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -maxdepth 1 -name 'fitness_*.dump.partial' -type f -mtime +1 -delete
echo "ok $(basename "$out") $(du -h "$out" | cut -f1)"
