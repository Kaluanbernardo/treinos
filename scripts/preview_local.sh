#!/usr/bin/env bash
# SÓ LOCAL / DADOS DE EXEMPLO. Sobe o app contra um Postgres 17 descartável com supabase/test/dev_synthetic.sql
# (~8 semanas inventadas) + PostgREST local, para screenshots e revisão visual. Nunca toca no banco real:
# não lê .env nem /home/box/.secrets; o segredo JWT é aleatório e fica em /tmp/fitlocal.
#
#   scripts/preview_local.sh up                      # Postgres (/tmp/pgtest:54329) + PostgREST (:3011)
#   scripts/preview_local.sh build [web_dir] [out]   # build apontando para o proxy local (padrão: web/ → /tmp/fitprev-local)
#   scripts/preview_local.sh serve [out] [porta]     # serve o build + proxy /rest/v1 (padrão: $PREVIEW_PORT ou 4174)
#   scripts/preview_local.sh down
#
# Sessão: o JWT do dono fica em /tmp/fitlocal/user.jwt (grave em localStorage['sb-127-auth-token']).
# PREVIEW_ACTIVE=1 (padrão) cria um treino de ficha em andamento hoje (séries feitas + 1 exercício pulado);
# PREVIEW_ACTIVE=0 deixa o dia sem treino aberto (cartão "Iniciar treino" / "Registrar cargas").
# PREVIEW_MEAL_PHOTO=<jpg> usa essa imagem como foto do café de exemplo (sem ela, um gradiente neutro);
# as imagens ficam em /tmp/fitlocal/storage/meals e o preview_server.mjs as serve como signed URLs.
# PostgREST: binário estático em $POSTGREST (padrão /tmp/pgrest_dl/postgrest, release v16 do GitHub).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/17/bin}"
POSTGREST="${POSTGREST:-/tmp/pgrest_dl/postgrest}"
L=/tmp/fitlocal
OWNER=11111111-1111-1111-1111-111111111111
DB="postgresql://postgres@/fitness?host=/tmp/pgtest&port=54329"
PORT="${PREVIEW_PORT:-4174}"   # porta do preview (o build aponta o Supabase para ela)
ACTIVE="${PREVIEW_ACTIVE:-1}"

jwt() { # jwt <role> [sub]
  node -e '
    const c = require("node:crypto"); const [s, role, sub] = process.argv.slice(1)
    const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url"); const now = Math.floor(Date.now() / 1000)
    const h = b({ alg: "HS256", typ: "JWT" }) + "." + b({ role, sub: sub || undefined, aud: role === "anon" ? undefined : "authenticated", iat: now, exp: now + 30 * 86400 })
    process.stdout.write(h + "." + c.createHmac("sha256", s).update(h).digest("base64url"))' "$(cat "$L/secret")" "$@"
}

case "${1:-}" in
  up)
    mkdir -p "$L"; chmod 700 "$L"
    pkill -f "[p]ostgrest $L/pgrest.conf" 2>/dev/null || true
    KEEP=1 "$ROOT/scripts/verify_local.sh" >"$L/verify.log" 2>&1 || { tail -20 "$L/verify.log"; exit 1; }
    echo "verify_local ok ($(grep -c '  ok' "$L/verify.log") checks); dados sintéticos aplicados"
    psql "$DB" -X -q -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit password 'localonly';
  end if;
end $$;
grant anon, authenticated to authenticator;
-- PostgREST ≥ 12 só preenche request.jwt.claims (json); o stub lia o GUC antigo
create or replace function auth.uid() returns uuid language sql stable as $f$
  select nullif(coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                         current_setting('request.jwt.claims', true)::json ->> 'sub'), '')::uuid
$f$;
-- extras de exemplo para as telas do dia (o sintético vai só até ontem): refeições de hoje + notas
insert into public.food_logs (date, meal, description, grams, portion_label, portion_qty, kcal, protein_g, carb_g, fat_g, estimated, logged_at, source, note)
select public.today_sp(), v.meal, v.descr, v.g, v.pl, v.pq, v.kcal, v.p, v.c, v.f, v.est,
       (public.today_sp() + v.t) at time zone 'America/Sao_Paulo', 'bot', 'synthetic'
from (values
  ('cafe',       'Iogurte, natural',              200, null, null, 102, 8.2, 3.8, 6.0, true,  time '07:40'),
  ('cafe',       'Chia (semente)',                 15, null, null,  73, 2.5, 6.3, 4.6, true,  time '07:40'),
  ('cafe',       'Uva, Itália, crua',              60, null, null,  32, 0.4, 8.2, 0.1, true,  time '07:40'),
  ('cafe',       'Mamão, Papaia, cru',             40, null, null,  16, 0.2, 4.2, 0.0, true,  time '07:40'),
  ('cafe',       'Aveia, flocos, crua',            15, null, null,  59, 2.1, 10.0, 1.3, true, time '07:40'),
  ('almoço',     'Arroz, integral, cozido',       150, null, null, 186, 3.9, 38.7, 1.5, false, time '12:30'),
  ('almoço',     'Feijão, carioca, cozido',       140, '1 concha', 1, 106, 6.7, 19.0, 0.7, false, time '12:30'),
  ('almoço',     'Frango, peito, sem pele, grelhado', 160, '1 filé', 1, 254, 51.2, 0.0, 4.0, false, time '12:30'),
  ('almoço',     'Salada de folhas com azeite',    80, null, null,  70, 1.0, 2.5, 6.3, true,  time '12:30'),
  ('pré-treino', 'Banana, prata, crua',            90, '1 unidade', 1, 88, 1.2, 23.4, 0.1, false, time '17:15'),
  ('pré-treino', 'Whey protein',                   30, '1 scoop', 1, 120, 24.0, 3.0, 1.5, false, time '17:15')
) v(meal, descr, g, pl, pq, kcal, p, c, f, est, t);
insert into public.meal_photos (date, meal, path, thumb_path, source, created_at)
values (public.today_sp(), 'cafe', 'exemplo/cafe.jpg', 'exemplo/cafe-thumb.jpg', 'bot',
        (public.today_sp() + time '07:38') at time zone 'America/Sao_Paulo');
insert into public.daily_checks (date, creatine, water_ml, source, note)
  values (public.today_sp(), false, 1500, 'bot', 'synthetic')
  on conflict (date) do update set water_ml = excluded.water_ml;
-- calorias de exemplo: perfil FICTÍCIO (só aqui, nunca no banco real) + kcal do relógio em parte das sessões
update public.profile set height_cm = 180, birth_date = '1990-01-01', sex = 'M';
insert into public.exercise_kcal (date, session_id, kcal, source, note)
select s.date, s.id, 280 + (extract(doy from s.date)::int * 37) % 240, 'relogio', 'synthetic'
from public.sessions s
where s.status = 'feito' and s.date >= public.today_sp() - 30 and extract(isodow from s.date) in (1, 3, 5);
insert into public.bot_notes (created_at, kind, text) values
  (now() - interval '2 hours', 'carga', 'Supino reto: 62,5 → 65 kg. Fechou 3×10 com RIR 2 nas duas últimas sessões.'),
  (now() - interval '5 hours', 'remarcacao', 'Inferiores A de terça foi para quarta 6h; terça virou Crossfit.'),
  (now() - interval '1 day 3 hours', 'resumo', 'Semana: 8 de 9 sessões, média 2.180 kcal e 168 g de proteína (6/7 dias).'),
  (now() - interval '3 days', 'alerta', 'Proteína abaixo de 164 g em 3 dias seguidos. Inclua um lanche com whey.'),
  (now() - interval '6 days', 'decisao', 'Déficit mantido em ~300 kcal: peso caindo 0,3%/sem, dentro do teto de 0,5%.');
SQL
    if [[ "$ACTIVE" == 1 ]]; then
      psql "$DB" -X -q -v ON_ERROR_STOP=1 <<'SQL'
-- treino em andamento de exemplo: a ficha de hoje (ou a primeira), 1º exercício completo, 2º com 1 série, 3º pulado
do $$
declare
  p record; tpl uuid; sid uuid := gen_random_uuid(); te record;
begin
  select * into p from public.plan_between(public.today_sp(), public.today_sp())
   where active and modality = 'musculacao' and template_id is not null order by start_time limit 1;
  tpl := coalesce(p.template_id, (select id from public.workout_templates order by slug limit 1));
  insert into public.sessions (id, date, modality, template_id, slot_id, override_id, status, started_at, source, note)
  values (sid, public.today_sp(), 'musculacao', tpl, p.slot_id, p.override_id, 'em_andamento', now() - interval '24 minutes', 'app', 'synthetic');
  for te in select t.exercise_id, t.position, t.sets, coalesce(t.reps_max, t.reps_min, 10) as reps,
                   coalesce((select sl.kg from public.set_logs sl where sl.exercise_id = t.exercise_id and not sl.warmup
                             order by sl.logged_at desc limit 1), t.carga_alvo, 20) as kg
            from public.template_exercises t where t.template_id = tpl and t.position <= 3 order by t.position
  loop
    if te.position = 3 then
      insert into public.session_exercise_status (session_id, exercise_id, skipped, source) values (sid, te.exercise_id, true, 'app');
    else
      insert into public.set_logs (session_id, exercise_id, set_number, kg, reps, logged_at, source)
      select sid, te.exercise_id, n, te.kg, te.reps - (n - 1), now() - make_interval(mins => 24 - te.position * 8 - n * 2), 'app'
      from generate_series(1, case when te.position = 1 then te.sets else 1 end) n;
    end if;
  end loop;
end $$;
SQL
      echo "treino em andamento de exemplo criado (PREVIEW_ACTIVE=0 para desligar)"
    fi
    mkdir -p "$L/storage/meals/exemplo"
    python3 -I - "${PREVIEW_MEAL_PHOTO:-}" "$L/storage/meals/exemplo" <<'PY'
import sys
from PIL import Image, ImageOps
src, out = sys.argv[1], sys.argv[2]
if src:
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
else:   # gradiente neutro, sem foto real
    im = Image.linear_gradient("L").resize((1200, 1600)).convert("RGB")
for name, size in (("cafe.jpg", 1600), ("cafe-thumb.jpg", 400)):
    x = im.copy(); x.thumbnail((size, size)); x.save(f"{out}/{name}", "JPEG", quality=80)
PY
    head -c 48 /dev/urandom | base64 | tr -d '\n/+=' >"$L/secret"; chmod 600 "$L/secret"
    cat >"$L/pgrest.conf" <<EOF
db-uri = "postgres://authenticator:localonly@127.0.0.1:54329/fitness"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$(cat "$L/secret")"
server-port = 3011
server-host = "127.0.0.1"
EOF
    chmod 600 "$L/pgrest.conf"
    jwt anon >"$L/anon.jwt"; jwt authenticated "$OWNER" >"$L/user.jwt"
    nohup "$POSTGREST" "$L/pgrest.conf" >"$L/pgrest.log" 2>&1 &
    for _ in $(seq 30); do curl -sf -o /dev/null http://127.0.0.1:3011/ -H "Authorization: Bearer $(cat "$L/user.jwt")" && break; sleep 0.3; done
    echo "PostgREST local ok em :3011"
    ;;
  build)
    WEB="${2:-$ROOT/web}"; OUT="${3:-/tmp/fitprev-local}"
    (cd "$WEB" && VITE_SUPABASE_URL="http://127.0.0.1:$PORT" VITE_SUPABASE_ANON_KEY="$(cat "$L/anon.jwt")" \
      npx vite build --base / --outDir "$OUT" --emptyOutDir >"$L/build.log" 2>&1) || { tail -20 "$L/build.log"; exit 1; }
    echo "build de exemplo em $OUT"
    ;;
  serve)
    OUT="${2:-/tmp/fitprev-local}"; PORT="${3:-$PORT}"
    pkill -f "[p]review_server.mjs .* $PORT$" 2>/dev/null || true
    nohup node "$ROOT/scripts/preview_server.mjs" "$OUT" "$PORT" >"$L/server-$PORT.log" 2>&1 &
    sleep 0.5; cat "$L/server-$PORT.log"
    ;;
  down)
    pkill -f "[p]ostgrest $L/pgrest.conf" 2>/dev/null || true
    pkill -f "[p]review_server.mjs .* $PORT$" 2>/dev/null || true
    "$PGBIN/pg_ctl" -D /tmp/pgtest/data -m fast stop >/dev/null 2>&1 || true
    echo "parado"
    ;;
  *) sed -n '2,15p' "$0"; exit 2 ;;
esac
