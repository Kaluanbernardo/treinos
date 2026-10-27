#!/usr/bin/env bash
# Keepalive diário por HTTPS: consulta leve como role bot; log em /workspace/fitness/backups/keepalive.log
set -uo pipefail
DIR="${BACKUP_DIR:-/workspace/fitness/backups}"; mkdir -p "$DIR"
FIT="$(dirname "$(readlink -f "$0")")/fit"
if "$FIT" sql "select count(*) as n from public.goals" >/dev/null 2>&1; then r=ok; else r=FAIL; fi
echo "$(date -Is) keepalive $r" >> "$DIR/keepalive.log"; [[ $r == ok ]]
