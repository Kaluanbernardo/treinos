#!/usr/bin/env bash
# Backup noturno por HTTPS (Management API): dump JSON de todas as tabelas de public em
# /workspace/fitness/backups/fitness_<data>.json.gz; retenção 30 dias. Token nunca impresso.
set -euo pipefail
DIR="${BACKUP_DIR:-/workspace/fitness/backups}"; mkdir -p "$DIR"; umask 077
FIT="$(dirname "$(readlink -f "$0")")/fit"
out="$DIR/fitness_$(date +%Y%m%d_%H%M).json.gz"
"$FIT" admin-sql "select json_object_agg(t.table_name, (xpath('/row/j/text()', query_to_xml(format('select coalesce(json_agg(x), ''[]'') as j from public.%I x', t.table_name), false, true, '')))[1]::text::json) as dump from information_schema.tables t where t.table_schema='public' and t.table_type='BASE TABLE'" \
  | python3 -c 'import json,sys; r=json.load(sys.stdin); print(json.dumps(r[0]["dump"], ensure_ascii=False))' | gzip > "$out.tmp"
mv "$out.tmp" "$out"
find "$DIR" -name 'fitness_*.json.gz' -mtime +30 -delete
echo "$(date -Is) ok $(basename "$out") $(stat -c%s "$out")B"
