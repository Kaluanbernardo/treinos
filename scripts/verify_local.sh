#!/usr/bin/env bash
# Verificação local completa num Postgres 17 descartável (/tmp/pgtest, porta 54329):
# stubs do Supabase + migrations + seed (2x, idempotência) + dados sintéticos, todas as views,
# permissões de bot / anon / authenticated. Sai != 0 em qualquer falha. Para o cluster no fim.
# Não toca no banco remoto.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/17/bin}"
BASE=/tmp/pgtest
PORT=54329
DATA="$BASE/data"

stop_cluster() { "$PGBIN/pg_ctl" -D "$DATA" -m fast stop >/dev/null 2>&1 || true; }
stop_cluster
rm -rf "$BASE"; mkdir -p "$BASE"
[[ -n "${KEEP:-}" ]] || trap 'stop_cluster' EXIT

"$PGBIN/initdb" -U postgres --auth-local=trust --auth-host=scram-sha-256 -D "$DATA" >/dev/null
# superuser só por socket (trust); TCP exige senha (testa o login real do bot)
"$PGBIN/pg_ctl" -D "$DATA" -l "$BASE/server.log" -w \
  -o "-p $PORT -k $BASE -c listen_addresses=127.0.0.1 -c timezone=UTC" start >/dev/null
SU="postgresql://postgres@/postgres?host=$BASE&port=$PORT"
psql "$SU" -X -q -c "create database fitness" >/dev/null
export SUPABASE_DB_URL="postgresql://postgres@/fitness?host=$BASE&port=$PORT"
export SECRETS_DIR="$BASE/secrets" BACKUP_DIR="$BASE/backups"

FAIL=0; PASS=0
ok()   { PASS=$((PASS + 1)); printf '  ok   %s\n' "$1"; }
fail() { FAIL=$((FAIL + 1)); printf '  FAIL %s\n' "$1"; [[ -n "${2:-}" ]] && printf '       %s\n' "$2"; }

# q <role> <sub|-> <sql>  → executa como role (set local role) com o JWT sub dado; imprime resultado
q() {
  local role="$1" sub="$2" sql="$3"
  local pre="begin; set local role $role;"
  [[ "$sub" != "-" ]] && pre="$pre select set_config('request.jwt.claim.sub', '$sub', true) \\g /dev/null"
  printf '%s\n%s;\nrollback;\n' "$pre" "$sql" | psql "$SUPABASE_DB_URL" -X -q -At -v ON_ERROR_STOP=1 2>&1
}
expect_eq() { # expect_eq <desc> <role> <sub> <sql> <esperado>
  local out; out="$(q "$2" "$3" "$4")" || { fail "$1" "$out"; return; }
  [[ "$out" == "$5" ]] && ok "$1" || fail "$1" "esperado [$5], veio [$out]"
}
expect_ok()   { local out; out="$(q "$2" "$3" "$4")" && ok "$1" || fail "$1" "$out"; }
expect_deny() { # deve falhar com erro de permissão/RLS
  local out; if out="$(q "$2" "$3" "$4")"; then fail "$1" "deveria falhar, veio [$out]"
  elif grep -qiE 'permission denied|row-level security|must be owner' <<<"$out"; then ok "$1"
  else fail "$1" "erro inesperado: $out"; fi
}

echo "== bootstrap + migrations"
psql "$SUPABASE_DB_URL" -X -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/test/00_supabase_stubs.sql" >/dev/null
"$ROOT/scripts/apply_migrations.sh" | sed 's/^/  /'
out="$("$ROOT/scripts/apply_migrations.sh" 2>&1)" || true
grep -q 'migrations novas: 0' <<<"$out" && ok "reaplicar: nada novo, seed idempotente" || fail "reaplicar" "$out"

echo "== seed"
expect_eq "25 exercícios"                 postgres - "select count(*) from exercises" 25
expect_eq "fichas: linhas por ficha"       postgres - "select string_agg(t.slug || '=' || (select count(*) from template_exercises te where te.template_id = t.id), ',' order by t.slug) from workout_templates t" \
  "inferiores_a=6,inferiores_b=7,superior_a=6,superior_b=7"
expect_eq "main lifts"                     postgres - "select count(*) from exercises where main_lift" 11
expect_eq "8 slots ativos, domingo vazio"  postgres - "select count(*) filter (where active) || '/' || count(*) filter (where weekday = 7) from schedule_slots" "8/0"
expect_eq "3 exceções da semana"           postgres - "select count(*) from schedule_overrides" 3
expect_eq "goals"                          postgres - "select deficit_kcal || ' ' || protein_g_per_kg_min || '-' || protein_g_per_kg_max || ' ' || max_loss_pct_week from goals" "300 2.0-2.2 0.50"
expect_eq "ter 27/10: crossfit (sem jiu-jitsu)" postgres - \
  "select string_agg(to_char(start_time,'HH24:MI') || ' ' || title || ' ' || modality || ' ' || plan_kind, ' | ' order by start_time) from plan_between('2026-10-27','2026-10-27')" \
  "06:00 Crossfit cross substituido"
expect_eq "qua 28/10: inferiores A 6h + cross" postgres - \
  "select string_agg(to_char(start_time,'HH24:MI') || ' ' || title || ' ' || plan_kind || ' ' || active || ' ' || exercise_count, ' | ' order by start_time) from plan_with_sessions('2026-10-28','2026-10-28')" \
  "06:00 Inferiores A adicionado true 6 | 20:00 Cross training base true 0"
expect_eq "qui 29/10: muay pulado"         postgres - \
  "select string_agg(to_char(start_time,'HH24:MI') || ' ' || title || ' ' || plan_kind || ' ' || active, ' | ' order by start_time) from plan_with_sessions('2026-10-29','2026-10-29')" \
  "06:00 Superior B base true | 20:00 Muay thai pulado false"
expect_eq "seg 02/11 volta à grade base"   postgres - \
  "select string_agg(title, ',' order by start_time) from plan_between('2026-11-02','2026-11-02')" "Superior A,Muay thai"

expect_eq "goals: peso_ref 94 → proteína 188–207 g" postgres - "select peso_ref_kg::int || ' ' || protein_g_min || '-' || protein_g_max from goals" "94 188-207"
expect_eq "body_metrics 27/10: 94 kg (bot)" postgres - "select peso_kg::int || ' ' || source from body_metrics where date = '2026-10-27'" "94 bot"

echo "== dono / RLS (antes de definir owner)"
OWNER=11111111-1111-1111-1111-111111111111
OTHER=22222222-2222-2222-2222-222222222222
psql "$SUPABASE_DB_URL" -X -q -c "insert into auth.users (id, email) values ('$OWNER', 'kaluan@example.com'), ('$OTHER', 'intruso@example.com')"
expect_eq "owner_uuid NULL: ninguém lê"    authenticated "$OWNER" "select count(*) from exercises" 0
out="$("$ROOT/scripts/set_owner.sh" "$OWNER" 2>&1)" || true; [[ "$out" == ok ]] && ok "set_owner.sh" || fail "set_owner.sh" "$out"

echo "== dados sintéticos (dev)"
psql "$SUPABASE_DB_URL" -X -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/test/dev_synthetic.sql" >/dev/null && ok "dev_synthetic.sql aplicado" || fail "dev_synthetic.sql"

echo "== views (como bot e como dono)"
VIEWS=(v_today v_week v_last_sets v_daily_nutrition v_weight_trend v_e1rm v_e1rm_session v_prs v_pr_bests
       v_recomposition v_streaks v_weekly_summary v_monthly_summary v_sessions v_nutrition_targets v_muscle_volume_weekly)
for v in "${VIEWS[@]}"; do
  inv="$(q postgres - "select (coalesce(reloptions::text, '') like '%security_invoker=true%')::int from pg_class where oid = 'public.$v'::regclass")" || true
  [[ "$inv" == 1 ]] || fail "$v security_invoker" "$inv"
  b="$(q bot - "select count(*) from $v")" || { fail "$v (bot)" "$b"; continue; }
  o="$(q authenticated "$OWNER" "select count(*) from $v")" || { fail "$v (dono)" "$o"; continue; }
  x="$(q authenticated "$OTHER" "select count(*) from $v")" || { fail "$v (outro)" "$x"; continue; }
  [[ "$b" == "$o" ]] && ok "$v: bot=$b dono=$o outro=$x" || fail "$v: bot=$b dono=$o divergem"
done
expect_eq "v_recomposition: cenário sintético = no_rumo" bot - \
  "select weight_arrow || ' ' || waist_arrow || ' ' || strength_arrow || ' ' || reading from v_recomposition" "down down up no_rumo"
expect_eq "v_recomposition: outro usuário vê 'coletando_dados'" authenticated "$OTHER" "select reading from v_recomposition" "coletando_dados"
expect_eq "aquecimento fora do 1RM/PR"      bot - "select (select count(*) from v_e1rm where set_number = 99) + (select count(*) from v_prs where set_number = 99)" 0
expect_eq "prev_bests ignora a própria sessão" bot - \
  "with s as (select session_id from v_prs order by date desc, logged_at desc limit 1) select count(*) from s, prev_bests(s.session_id) b join v_pr_bests p using (exercise_id) where b.best_kg > p.best_kg" 0
expect_eq "prev_sets não devolve a sessão excluída" bot - \
  "with s as (select session_id from set_logs order by logged_at desc limit 1) select count(*) from s, prev_sets(s.session_id) p where p.session_id = s.session_id" 0
expect_eq "v_sessions: volume = soma das séries" bot - \
  "select count(*) from v_sessions v where v.volume_kg <> (select coalesce(sum(coalesce(kg,0)*coalesce(reps,0)),0) from set_logs sl where sl.session_id = v.id and not sl.warmup)" 0
expect_eq "TACO: 597 alimentos"             bot - "select count(*) from foods where code like 'taco:%'" 597
expect_eq "food_search sem acento acha feijão carioca" bot - "select count(*) from food_search('feijao carioca cozido', 5) where code = 'taco:561'" 1
expect_eq "food_search: medidas caseiras" bot - "select portions from food_search('ovo cozido', 10) where code = 'taco:488'" "1 unidade = 50 g"
expect_eq "v_nutrition_targets: proteína 2,0–2,2 g/kg" bot - "select (protein_min_g between 150 and 220)::int from v_nutrition_targets" 1
expect_eq "Epley: 100 kg × 10 = 133,33"     bot - "select round(100 * (1 + 10 / 30.0), 2)" "133.33"
expect_ok "Epley em v_e1rm confere"         bot - "select 1/(count(*) = 0)::int from v_e1rm where e1rm <> round(kg * (1 + reps / 30.0), 2) or reps > 12"
expect_ok "há PRs com flag"                 bot - "select 1/(count(*) > 0)::int from v_prs where is_pr"
# PR só quando supera ESTRITAMENTE: exercício isolado com sequência conhecida (tudo em rollback)
PR_SEQ="with e as (insert into exercises (slug, name, muscle_group) values ('teste_pr', 'Teste PR', 'peito') returning id),
  s as (insert into sessions (date, modality, status) values ('2026-10-01', 'musculacao', 'feito'), ('2026-10-03', 'musculacao', 'feito') returning id, date),
  l as (insert into set_logs (session_id, exercise_id, set_number, kg, reps, logged_at)
        select s.id, e.id, v.n, v.kg, v.reps, s.date + v.n * interval '1 minute'
        from e, s join (values ('2026-10-01'::date, 1, 62.5, 7), ('2026-10-01', 2, 75, 2),
                               ('2026-10-03', 1, 62.5, 7), ('2026-10-03', 2, 60, 10), ('2026-10-03', 3, 75, 2),
                               ('2026-10-03', 4, 62.5, 10)) v(d, n, kg, reps) on v.d = s.date
        returning 1)
  select count(*) from l"
expect_eq "PR: empate (mesma carga × reps, ou 1RM igual com carga menor) não é PR; só o estritamente melhor" postgres - \
  "$PR_SEQ; select string_agg(to_char(date, 'DD') || ':' || kg::float || 'x' || reps || '=' || is_pr, ' ' order by date, set_number) from v_prs where exercise_name = 'Teste PR'" \
  "6
01:62.5x7=false 01:75x2=true 03:62.5x7=false 03:60x10=false 03:75x2=false 03:62.5x10=true"
expect_eq "PR: prev_bests da 2ª sessão = 75 kg / 80,00" postgres - \
  "$PR_SEQ; select b.best_kg::float || ' ' || b.best_e1rm from prev_bests((select session_id from set_logs where exercise_id = (select id from exercises where slug = 'teste_pr') order by logged_at desc limit 1)) b join exercises x on x.id = b.exercise_id where x.slug = 'teste_pr'" \
  "6
75 80.00"
# a regra de PR do app (web/src/lib/pr.ts) bate com o banco: casos de empate + a mesma conta de Epley numa grade
if [[ -x "$ROOT/web/node_modules/.bin/jiti" ]]; then
  q postgres - "select json_agg(json_build_array(kg, reps, round(kg * (1 + reps / 30.0), 2))) from generate_series(25, 25000, 25) g(c), generate_series(1, 12) reps, lateral (select (c / 100.0)::numeric(6,2) as kg) k" \
    >"$BASE/e1rm_grid.json"
  if out="$(cd "$ROOT/web" && node_modules/.bin/jiti scripts/test-pr.ts "$BASE/e1rm_grid.json" 2>&1)"; then
    ok "PR no app: $(grep -c '  ok' <<<"$out") casos (empates sem selo, Epley igual ao do banco)"
  else fail "PR no app (web/scripts/test-pr.ts)" "$(grep -E 'FAIL|rror' <<<"$out" | head -5)"; fi
else fail "PR no app" "web/node_modules ausente (rode npm install em web/)"; fi
expect_ok "média 7d por janela de data"     bot - \
  "select 1/(count(*) = 0)::int from v_weight_trend t where t.avg_7d <> round((select avg(b.peso_kg) from body_metrics b where b.peso_kg is not null and b.date between t.date - 6 and t.date), 2)"
expect_eq "v_streaks tem as 5 modalidades + total" bot - "select count(*) from v_streaks" 6
expect_ok "resumo semanal: dias registrados ≤ 7" bot - "select 1/(count(*) = 0)::int from v_weekly_summary where days_logged > 7 or done > planned"
expect_ok "v_today usa fuso America/Sao_Paulo" bot - \
  "select 1/(count(*) = 0)::int from v_today where date <> (now() at time zone 'America/Sao_Paulo')::date"

echo "== role bot"
expect_eq "bot: NOBYPASSRLS, sem superuser/createrole" postgres - \
  "select rolbypassrls || ' ' || rolsuper || ' ' || rolcreaterole || ' ' || rolcreatedb from pg_roles where rolname = 'bot'" "false false false false"
expect_ok   "bot: SELECT"                     bot - "select count(*) from sessions"
expect_ok   "bot: INSERT bot_notes"           bot - "insert into bot_notes (kind, text, source) values ('nota', 'teste', 'bot')"
expect_ok   "bot: UPDATE template carga_alvo" bot - "update template_exercises set carga_alvo = 62.5 where position = 1"
expect_ok   "bot: upsert body_metrics"        bot - "insert into body_metrics (date, peso_kg, source) values (today_sp(), 81.5, 'bot') on conflict (date) do update set peso_kg = excluded.peso_kg"
expect_ok   "bot: DELETE schedule_overrides"  bot - "delete from schedule_overrides where date = '2000-01-01'"
expect_ok   "bot: DELETE food_logs"           bot - "delete from food_logs where date = '2000-01-01'"
expect_deny "bot: DELETE exercises negado"    bot - "delete from exercises where slug = 'x'"
expect_ok   "bot: DELETE sessions (F1: desfazer)" bot - "delete from sessions where date = '2000-01-01'"
expect_deny "bot: CREATE TABLE negado"        bot - "create table public.hack (id int)"
expect_deny "bot: DROP TABLE negado"          bot - "drop table public.bot_notes"
expect_deny "bot: ALTER TABLE negado"         bot - "alter table public.sessions add column x int"
expect_deny "bot: auth.users negado"          bot - "select count(*) from auth.users"
expect_deny "bot: app_config negado"          bot - "select * from app_config"
expect_deny "bot: _migrations negado"         bot - "select * from _migrations"

echo "== anon"
expect_deny "anon: exercises negado"          anon - "select count(*) from exercises"
expect_deny "anon: v_today negado"            anon - "select count(*) from v_today"
expect_deny "anon: INSERT negado"             anon - "insert into bot_notes (text) values ('x')"
expect_deny "anon: app_config negado"         anon - "select * from app_config"
expect_deny "anon: is_owner() negado"         anon - "select public.is_owner()"
expect_eq   "anon: nenhuma tabela/view com privilégio" postgres - \
  "select count(*) from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public'" 0

echo "== authenticated"
expect_eq   "dono: vê 25 exercícios"          authenticated "$OWNER" "select count(*) from exercises" 25
expect_eq   "dono: is_owner() = true"         authenticated "$OWNER" "select public.is_owner()" t
expect_ok   "dono: INSERT bot_notes"          authenticated "$OWNER" "insert into bot_notes (text, source) values ('do app', 'app')"
expect_eq   "outro: vê 0 exercícios"          authenticated "$OTHER" "select count(*) from exercises" 0
expect_eq   "outro: vê 0 sessões"             authenticated "$OTHER" "select count(*) from sessions" 0
expect_eq   "outro: is_owner() = false"       authenticated "$OTHER" "select public.is_owner()" f
expect_deny "outro: INSERT bloqueado por RLS" authenticated "$OTHER" "insert into bot_notes (text) values ('x')"
expect_eq   "outro: UPDATE não afeta nada"    authenticated "$OTHER" "with u as (update exercises set name = 'x' returning 1) select count(*) from u" 0
expect_eq   "sem sub: vê 0"                   authenticated - "select count(*) from exercises" 0
expect_deny "dono: app_config negado"         authenticated "$OWNER" "select * from app_config"
expect_deny "dono: DROP negado"               authenticated "$OWNER" "drop table public.goals"

echo "== scripts"
out="$("$ROOT/scripts/create_bot_role_password.sh" 2>&1)" || true
[[ "$out" == ok ]] && ok "create_bot_role_password.sh imprime só ok" || fail "create_bot_role_password.sh" "$out"
f="$SECRETS_DIR/fitness_bot_db_url"
[[ "$(stat -c %a "$f")" == 600 ]] && ok "arquivo da URL do bot com chmod 600" || fail "chmod do arquivo do bot"
# a URL gerada aponta para socket; o login real por senha é testado via TCP
botpw="$(sed -E 's#^[^:]+://[^:]+:([^@]+)@.*#\1#' "$f")"
if r="$(PGPASSWORD="$botpw" psql "host=127.0.0.1 port=$PORT dbname=fitness user=bot" -X -At -c "select count(*) from exercises" 2>&1)" && [[ "$r" == 25 ]]; then
  ok "bot loga por TCP com a senha gerada (scram)"
else fail "login do bot" "$r"; fi
if r="$(PGPASSWORD="$botpw" psql "host=127.0.0.1 port=$PORT dbname=fitness user=bot" -X -At -c "create table hack(i int)" 2>&1)"; then
  fail "bot logado: CREATE TABLE deveria falhar"
else ok "bot logado: CREATE TABLE negado"; fi
unset botpw
out="$(bash -c 'source "$1/scripts/lib.sh"; bot_url "$2" "$3"' _ "$ROOT" \
       'postgresql://postgres.abcdefref:segredo@aws-0-sa-east-1.pooler.supabase.com:5432/postgres' "$(printf 'a%.0s' {1..64})")" || true
[[ "$out" == "postgresql://bot.abcdefref:$(printf 'a%.0s' {1..64})@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require" ]] \
  && ok "URL do pooler vira bot.<project_ref>" || fail "URL do pooler" "formato inesperado"
out="$(bash -c 'source "$1/scripts/lib.sh"; bot_url "$2" pw' _ "$ROOT" 'postgresql://postgres:s@db.qlphmxjehsexuxspspaw.supabase.co:5432/postgres')" || true
[[ "$out" == "postgresql://bot:pw@db.qlphmxjehsexuxspspaw.supabase.co:5432/postgres?sslmode=require" ]] \
  && ok "URL direta vira usuário bot" || fail "URL direta" "formato inesperado"
out="$(BOT_URL_FILE="$f" "$ROOT/scripts/keepalive.sh" 2>&1)" ; true
grep -q 'ok sql' "$BACKUP_DIR/keepalive.log" && ok "keepalive.sh (sql)" || fail "keepalive.sh" "$(cat "$BACKUP_DIR/keepalive.log" 2>/dev/null)"
out="$("$ROOT/scripts/backup_nightly.sh" 2>&1)" || true
if [[ "$out" == ok* ]] && "$PGBIN/pg_restore" -l "$BACKUP_DIR"/fitness_*.dump | grep -q 'TABLE DATA public exercises'; then
  ok "backup_nightly.sh gera dump restaurável"
else fail "backup_nightly.sh" "$out"; fi
touch -d '40 days ago' "$BACKUP_DIR/fitness_20000101_000000.dump"
"$ROOT/scripts/backup_nightly.sh" >/dev/null || true
[[ ! -e "$BACKUP_DIR/fitness_20000101_000000.dump" ]] && ok "retenção remove dumps > 30 dias" || fail "retenção"

echo
echo "resultado: $PASS ok, $FAIL falhas"
[[ $FAIL -eq 0 ]]
