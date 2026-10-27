-- DEV ONLY: ~8 semanas de dados sintéticos (até ontem) para conferir as views de evolução.
-- NUNCA aplicar no banco real. Usado por scripts/verify_local.sh.
-- Cenário: peso caindo ~0,3 kg/sem com ruído, cintura caindo, cargas subindo → "no_rumo".

begin;

do $$ begin
  if exists (select 1 from public.sessions where note = 'synthetic') then
    raise exception 'dados sintéticos já aplicados';
  end if;
end $$;

-- corpo: pesagem em 6 de 7 dias; cintura semanal (a última é ontem)
insert into public.body_metrics (date, peso_kg, cintura_cm, braco_cm, nota)
select public.today_sp() - 56 + i,
       round((84.0 - 0.043 * i + 0.4 * sin(i * 1.3))::numeric, 2),
       case when (55 - i) % 7 = 0 then round((90.0 - 0.035 * i)::numeric, 1) end,
       case when (55 - i) % 28 = 0 then 37.0 + 0.005 * i end,
       'synthetic'
from generate_series(0, 55) i
where i % 7 <> 2;

-- sessões conforme o plano (grade + exceções), ~1 em 11 faltou
insert into public.sessions (date, modality, template_id, slot_id, override_id, status, started_at, ended_at, note, source)
select p.date, p.modality, p.template_id, p.slot_id, p.override_id,
       case when (extract(doy from p.date)::int + extract(hour from p.start_time)::int) % 11 = 0
            then 'faltou' else 'feito' end,
       (p.date + p.start_time) at time zone 'America/Sao_Paulo',
       (p.date + p.start_time + make_interval(mins => p.duration_min)) at time zone 'America/Sao_Paulo',
       'synthetic', 'bot'
from public.plan_between(public.today_sp() - 56, public.today_sp() - 1) p
where p.active;

-- séries: carga base × progressão ~0,4%/dia, arredondada a 2,5 kg
with base (slug, kg) as (values
  ('supino_reto', 60), ('puxada_frontal', 55), ('desenvolvimento_halteres', 18), ('remada_curvada', 50),
  ('elevacao_lateral', 8), ('triceps_corda', 20), ('barra_fixa', 0), ('supino_inclinado_halteres', 22),
  ('remada_unilateral', 24), ('face_pull', 15), ('rosca_direta', 25), ('agachamento_livre', 70),
  ('leg_press_45', 140), ('afundo_bulgaro', 12), ('cadeira_extensora', 40), ('mesa_flexora', 35),
  ('panturrilha_em_pe', 60), ('terra_romeno', 70), ('hip_thrust', 80), ('flexora', 35),
  ('goblet_ou_hack', 24), ('panturrilha_sentado', 40), ('farmers_walk', 24), ('pescoco_anilha', 5)
),
src as (
  select s.id as session_id, s.date, s.started_at, te.exercise_id, te.position, te.sets,
         te.reps_min, te.reps_max, te.reps_unit, b.kg as base_kg,
         (s.date - (public.today_sp() - 56)) as day_idx
  from public.sessions s
  join public.template_exercises te on te.template_id = s.template_id
  join public.exercises e on e.id = te.exercise_id
  join base b on b.slug = e.slug
  where s.note = 'synthetic' and s.status = 'feito' and te.reps_unit = 'reps'
)
insert into public.set_logs (session_id, exercise_id, set_number, kg, reps, rir, warmup, logged_at, source)
select src.session_id, src.exercise_id, n,
       case when src.base_kg = 0 then 0
            else round(src.base_kg * (1 + 0.004 * src.day_idx) / 2.5) * 2.5 end,
       greatest(src.reps_min, src.reps_max - (n - 1)),
       2, false,
       src.started_at + make_interval(mins => src.position * 8 + n * 2),
       'bot'
from src, generate_series(1, src.sets) n;

-- 1 série de aquecimento no 1º exercício de cada sessão (não pode virar PR nem entrar no 1RM)
insert into public.set_logs (session_id, exercise_id, set_number, kg, reps, warmup, logged_at, source)
select sl.session_id, sl.exercise_id, 99, sl.kg * 2, 3, true, sl.logged_at - interval '5 minutes', 'bot'
from public.set_logs sl
join public.sessions s on s.id = sl.session_id
join public.template_exercises te on te.template_id = s.template_id and te.exercise_id = sl.exercise_id
where s.note = 'synthetic' and te.position = 1 and sl.set_number = 1;

-- nutrição: 6 de 7 dias registrados
insert into public.food_logs (date, meal, description, grams, kcal, protein_g, carb_g, fat_g, estimated, source, note)
select public.today_sp() - 56 + i, m.meal, m.descr, m.g, m.kcal, m.p, m.c, m.f, m.est, 'bot', 'synthetic'
from generate_series(0, 55) i
cross join (values
  ('pré-treino', 'Banana com whey',        150, 230, 26, 30, 2,  false),
  ('almoço',     'Arroz, feijão e frango', 450, 720, 52, 85, 16, true),
  ('lanche',     'Iogurte com aveia',      250, 320, 22, 40, 7,  false),
  ('jantar',     'Carne, batata e salada', 400, 650, 50, 45, 25, true)
) m(meal, descr, g, kcal, p, c, f, est)
where i % 7 <> 3;

insert into public.daily_checks (date, creatine, creatine_g, water_ml, source, note)
select public.today_sp() - 56 + i, i % 5 <> 0, case when i % 5 <> 0 then 5 end, 3000, 'bot', 'synthetic'
from generate_series(0, 55) i;

update public.goals set kcal_target = 2200;

commit;
