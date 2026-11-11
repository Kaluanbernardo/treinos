-- Meta semanal de treinos + faixa de proteína flexível (pedido do Kaluan em 11/11/2026).
--
-- Só aditiva: colunas novas em goals, duas views novas e colunas novas no FIM de v_sessions.
-- Nada é apagado: as colunas antigas de proteína (protein_g_per_kg_min/max, protein_g_min/max) e de
-- creatina (daily_checks.creatine, goals.creatine_g_*) ficam com os dados; só deixam de ser lidas pelo
-- app e pelos resumos do `fit`.
--
-- 1. Meta semanal: mínimo 4, máximo 9 atividades FEITAS por semana (seg–dom), qualquer modalidade
--    (musculação, muay thai, funcional, cross...). Feito = sessão 'feito' ou 'parcial'. A grade continua
--    como plano flexível; a aderência à grade deixa de ser a métrica principal.
-- 2. Proteína: faixa em g/kg sobre um peso de referência (docs/proteina.md):
--      mínimo efetivo 1,3 · ideal 1,6 (platô de Morton et al. 2018) · teto útil 2,2 (IC 95 % do platô)
--    Peso de referência = última pesagem, limitada ao peso do IMC 30 (Weijs 2025: a gordura acima do
--    IMC 30 pode ser ignorada usando um peso ajustado máximo no IMC 30). Sem altura: a última pesagem.

-- ---------------------------------------------------------------- metas
alter table public.goals add column if not exists weekly_sessions_min integer not null default 4
  check (weekly_sessions_min between 0 and 21);
alter table public.goals add column if not exists weekly_sessions_max integer not null default 9
  check (weekly_sessions_max between 1 and 21);
alter table public.goals add column if not exists protein_min_g_per_kg numeric(3,1) not null default 1.3
  check (protein_min_g_per_kg between 0.8 and 3.0);
alter table public.goals add column if not exists protein_ideal_g_per_kg numeric(3,1) not null default 1.6
  check (protein_ideal_g_per_kg between 0.8 and 3.0);
alter table public.goals add column if not exists protein_cap_g_per_kg numeric(3,1) not null default 2.2
  check (protein_cap_g_per_kg between 0.8 and 3.5);
-- IMC máximo do peso de referência da proteína (NULL = sempre o peso da balança)
alter table public.goals add column if not exists protein_ref_bmi_max numeric(4,1) default 30
  check (protein_ref_bmi_max between 18 and 40);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'goals_weekly_sessions_order') then
    alter table public.goals add constraint goals_weekly_sessions_order check (weekly_sessions_min <= weekly_sessions_max);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'goals_protein_order') then
    alter table public.goals add constraint goals_protein_order
      check (protein_min_g_per_kg <= protein_ideal_g_per_kg and protein_ideal_g_per_kg <= protein_cap_g_per_kg);
  end if;
end $$;

comment on column public.goals.weekly_sessions_min is 'Meta semanal: mínimo de atividades feitas (feito/parcial) por semana, qualquer modalidade.';
comment on column public.goals.weekly_sessions_max is 'Meta semanal: máximo recomendado de atividades por semana (acima disso o app avisa).';
comment on column public.goals.protein_min_g_per_kg is 'Proteína: mínimo efetivo (g/kg do peso de referência). docs/proteina.md';
comment on column public.goals.protein_ideal_g_per_kg is 'Proteína: início da faixa ideal, platô de Morton et al. 2018 (g/kg).';
comment on column public.goals.protein_cap_g_per_kg is 'Proteína: teto útil, limite superior do IC 95 % do platô (g/kg).';
comment on column public.goals.protein_ref_bmi_max is 'Proteína: o peso de referência não passa do peso deste IMC (Weijs 2025). NULL = peso da balança.';

-- ---------------------------------------------------------------- semanas de treino
-- 1 linha por semana (segunda a domingo), da semana da primeira sessão até a atual.
-- done = sessões feito + parcial (qualquer modalidade, planejadas ou não); missed = faltou.
-- met = done >= mínimo. streak_weeks = semanas seguidas com o mínimo terminando nesta semana; na semana
-- atual, enquanto o mínimo não chega, repete a sequência da semana anterior (semana em andamento não quebra).
create or replace view public.v_training_weeks with (security_invoker = true) as
  with t as (select public.today_sp() as d, public.week_start(public.today_sp()) as cw),
  g as (
    select coalesce((select gg.weekly_sessions_min from public.goals gg limit 1), 4) as gmin,
           coalesce((select gg.weekly_sessions_max from public.goals gg limit 1), 9) as gmax
  ),
  b as (
    select public.week_start(least(coalesce((select min(s.date) from public.sessions s), t.d), t.d)) as first_ws, t.cw, t.d
    from t
  ),
  weeks as (
    select gs::date as ws from b, generate_series(b.first_ws::timestamp, b.cw::timestamp, interval '7 days') gs
  ),
  s as (
    select public.week_start(x.date) as ws,
           count(*) filter (where x.status in ('feito', 'parcial'))::int as done,
           count(*) filter (where x.status = 'feito')::int as n_feito,
           count(*) filter (where x.status = 'parcial')::int as n_parcial,
           count(*) filter (where x.status = 'faltou')::int as missed
    from public.sessions x
    group by 1
  ),
  m as (
    select y.ws, jsonb_object_agg(y.modality, y.n) as by_modality
    from (select public.week_start(x.date) as ws, x.modality::text as modality, count(*)::int as n
          from public.sessions x where x.status in ('feito', 'parcial') group by 1, 2) y
    group by y.ws
  ),
  p as (
    select public.week_start(pb.date) as ws, count(*)::int as planned
    from b, public.plan_between(b.first_ws, b.cw + 6) pb
    where pb.active
    group by 1
  ),
  w as (
    select wk.ws, (wk.ws + 6) as we, (wk.ws = b.cw) as is_current,
           coalesce(s.done, 0) as done, coalesce(s.n_feito, 0) as n_feito, coalesce(s.n_parcial, 0) as n_parcial,
           coalesce(s.missed, 0) as missed, coalesce(p.planned, 0) as planned,
           coalesce(m.by_modality, '{}'::jsonb) as by_modality,
           g.gmin, g.gmax,
           coalesce(s.done, 0) >= g.gmin as met
    from weeks wk
    cross join b
    cross join g
    left join s on s.ws = wk.ws
    left join m on m.ws = wk.ws
    left join p on p.ws = wk.ws
  ),
  isl as (
    select w.*,
           sum(case when w.met then 0 else 1 end) over (order by w.ws) as grp
    from w
  ),
  run as (
    select isl.*,
           case when isl.met then count(*) filter (where isl.met) over (partition by isl.grp order by isl.ws) else 0 end as run_len
    from isl
  )
  select r.ws as week_start, r.we as week_end, r.is_current,
         r.done, r.n_feito, r.n_parcial, r.missed, r.planned, r.by_modality,
         r.gmin as goal_min, r.gmax as goal_max, r.met,
         case when r.done < r.gmin then 'abaixo' when r.done > r.gmax then 'acima' else 'na_faixa' end as status,
         greatest(r.gmin - r.done, 0) as to_min,
         case when r.met then r.run_len
              when r.is_current then coalesce(lag(r.run_len) over (order by r.ws), 0)
              else 0 end::int as streak_weeks,
         (max(r.run_len) over ())::int as best_streak_weeks
  from run r
  order by r.ws;

revoke all on public.v_training_weeks from public, anon;
grant select on public.v_training_weeks to authenticated, bot;

-- ---------------------------------------------------------------- proteína
-- 1 linha. Peso = última pesagem (body_metrics), senão goals.peso_ref_kg. Referência = menor entre esse
-- peso e o peso no IMC goals.protein_ref_bmi_max (padrão 30), quando há altura no perfil.
-- Zonas do dia: abaixo < min_g ≤ ok < ideal_g ≤ ideal ≤ cap_g < acima.
create or replace view public.v_protein_target with (security_invoker = true) as
  with g as (select * from public.goals limit 1),
  w as (
    select bm.peso_kg, bm.date from public.body_metrics bm
    where bm.peso_kg is not null order by bm.date desc limit 1
  ),
  pr as (select pf.height_cm from public.profile pf limit 1),
  base as (
    select coalesce(w.peso_kg, g.peso_ref_kg) as weight_kg,
           case when w.peso_kg is not null then w.date end as weight_date,
           pr.height_cm,
           case when pr.height_cm is not null and g.protein_ref_bmi_max is not null
                then round(g.protein_ref_bmi_max * (pr.height_cm / 100.0) * (pr.height_cm / 100.0), 1) end as bmi_cap_kg,
           g.protein_min_g_per_kg, g.protein_ideal_g_per_kg, g.protein_cap_g_per_kg, g.protein_ref_bmi_max
    from g
    left join w on true
    left join pr on true
  ),
  r as (
    select base.*,
           case when base.bmi_cap_kg is not null and base.weight_kg > base.bmi_cap_kg then base.bmi_cap_kg
                else base.weight_kg end as ref_kg
    from base
  )
  select r.weight_kg, r.weight_date, r.height_cm,
         case when r.height_cm is not null and r.weight_kg is not null
              then round(r.weight_kg / ((r.height_cm / 100.0) * (r.height_cm / 100.0)), 1) end as bmi,
         r.bmi_cap_kg, r.protein_ref_bmi_max as ref_bmi_max,
         round(r.ref_kg, 1) as ref_weight_kg,
         case when r.weight_kg is null then 'sem_peso'
              when r.bmi_cap_kg is not null and r.weight_kg > r.bmi_cap_kg then 'teto_imc'
              else 'peso' end as ref_basis,
         r.protein_min_g_per_kg as min_g_per_kg, r.protein_ideal_g_per_kg as ideal_g_per_kg, r.protein_cap_g_per_kg as cap_g_per_kg,
         round(r.ref_kg * r.protein_min_g_per_kg)::int as min_g,
         round(r.ref_kg * r.protein_ideal_g_per_kg)::int as ideal_g,
         round(r.ref_kg * r.protein_cap_g_per_kg)::int as cap_g
  from r;

revoke all on public.v_protein_target from public, anon;
grant select on public.v_protein_target to authenticated, bot;

-- ---------------------------------------------------------------- sessões: origem no plano
-- Colunas novas no fim (create or replace view só aceita acrescentar): slot/override da sessão e o tipo
-- do item do plano ('base' | 'substituido' | 'adicionado'; NULL = fora do plano). O histórico do app mostra
-- "remarcado" para 'adicionado', o mesmo rótulo da Agenda.
create or replace view public.v_sessions with (security_invoker = true) as
  select s.id, s.date, s.modality, public.modality_label(s.modality) as modality_label,
         s.template_id, wt.slug as template_slug, coalesce(wt.name, public.modality_label(s.modality)) as title,
         s.status, s.started_at, s.ended_at, s.note, s.source,
         case when s.started_at is not null and s.ended_at is not null
              then round(extract(epoch from s.ended_at - s.started_at) / 60)::int end as duration_min,
         coalesce(a.n_sets, 0) as n_sets,
         coalesce(a.n_exercises, 0) as n_exercises,
         coalesce(a.volume_kg, 0) as volume_kg,
         coalesce(p.n_prs, 0) as n_prs,
         coalesce(k.n_skipped, 0) as n_skipped,
         s.slot_id, s.override_id,
         case when o.action = 'add' then 'adicionado'
              when o.action = 'replace' then 'substituido'
              when s.slot_id is not null then 'base' end as plan_kind,
         o.motivo as plan_motivo
  from public.sessions s
  left join public.workout_templates wt on wt.id = s.template_id
  left join public.schedule_overrides o on o.id = s.override_id
  left join lateral (
    select count(*)::int as n_sets, count(distinct sl.exercise_id)::int as n_exercises,
           sum(coalesce(sl.kg, 0) * coalesce(sl.reps, 0)) as volume_kg
    from public.set_logs sl where sl.session_id = s.id and not sl.warmup
  ) a on true
  left join lateral (
    select count(distinct p.exercise_id)::int as n_prs from public.v_prs p where p.session_id = s.id and p.is_pr
  ) p on true
  left join lateral (
    select count(*)::int as n_skipped from public.session_exercise_status x where x.session_id = s.id and x.skipped
  ) k on true;

revoke all on public.v_sessions from public, anon;
grant select on public.v_sessions to authenticated, bot;
