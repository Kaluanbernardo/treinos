-- F0 · Views compartilhadas por app e bot (todas security_invoker → respeitam RLS).
-- Corte de dia/semana/mês em America/Sao_Paulo (public.today_sp(); colunas `date` já são locais).

-- Idempotência: recria todas as views deste arquivo.
drop view if exists
  public.v_monthly_summary, public.v_weekly_summary, public.v_streaks, public.v_recomposition,
  public.v_daily_nutrition, public.v_pr_bests, public.v_prs, public.v_e1rm_session, public.v_e1rm,
  public.v_weight_trend, public.v_last_sets, public.v_week, public.v_today
  cascade;

-- ---------------------------------------------------------------- helpers
create or replace function public.modality_label(m public.modality)
returns text
language sql immutable
set search_path = ''
as $$
  select case m
    when 'musculacao' then 'Musculação'
    when 'muay_thai'  then 'Muay thai'
    when 'jiu_jitsu'  then 'Jiu-jitsu'
    when 'cross'      then 'Cross'
    when 'funcional'  then 'Funcional'
  end
$$;

-- direção de uma variação: 'down' | 'flat' | 'up' (null se sem dado). "Estável" se |Δ| < limiar.
create or replace function public.trend_arrow(delta numeric, threshold numeric)
returns text
language sql immutable
set search_path = ''
as $$
  select case
    when delta is null then null
    when delta <= -threshold then 'down'
    when delta >= threshold then 'up'
    else 'flat'
  end
$$;

create or replace function public.week_start(d date)
returns date
language sql immutable
set search_path = ''
as $$ select date_trunc('week', d::timestamp)::date $$;

-- Plano (grade base + exceções) para um intervalo de datas.
-- plan_kind: base | substituido | adicionado | pulado  (pulado vem com active = false)
create or replace function public.plan_between(p_from date, p_to date)
returns table (
  date          date,
  start_time    time,
  duration_min  integer,
  modality      public.modality,
  template_id   uuid,
  title         text,
  plan_kind     text,
  slot_id       uuid,
  override_id   uuid,
  motivo        text,
  active        boolean
)
language sql stable
security invoker
set search_path = ''
as $$
  with days as (
    select g::date as d
    from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') g
  ),
  base as (
    select dd.d, s.id as sid, s.start_time as st, s.duration_min as dur, s.modality as m,
           s.template_id as tid, s.title as ttl
    from days dd
    join public.schedule_slots s on s.active and s.weekday = extract(isodow from dd.d)
  )
  select b.d,
         case when o.action = 'replace' then coalesce(o.start_time, b.st) else b.st end,
         case when o.action = 'replace' then coalesce(o.duration_min, b.dur) else b.dur end,
         case when o.action = 'replace' then coalesce(o.modality, b.m) else b.m end,
         case
           when o.action is distinct from 'replace' then b.tid
           when o.template_id is not null then o.template_id
           when o.modality is null or o.modality = b.m then b.tid
           else null
         end,
         case when o.action = 'replace' then coalesce(o.title, b.ttl) else b.ttl end,
         case o.action when 'replace' then 'substituido' when 'skip' then 'pulado' else 'base' end,
         b.sid,
         o.id,
         o.motivo,
         o.action is distinct from 'skip'
  from base b
  left join lateral (
    select so.* from public.schedule_overrides so
    where so.slot_id = b.sid and so.date = b.d and so.action in ('skip', 'replace')
    order by so.created_at desc
    limit 1
  ) o on true
  union all
  select so.date, so.start_time, coalesce(so.duration_min, 60), so.modality, so.template_id,
         coalesce(so.title, wt.name, public.modality_label(so.modality)),
         'adicionado', null, so.id, so.motivo, true
  from public.schedule_overrides so
  left join public.workout_templates wt on wt.id = so.template_id
  where so.action = 'add' and so.date between p_from and p_to
$$;

-- Plano + sessão correspondente (se houver) + info da ficha.
create or replace function public.plan_with_sessions(p_from date, p_to date)
returns table (
  date            date,
  start_time      time,
  duration_min    integer,
  starts_at       timestamptz,
  ends_at         timestamptz,
  modality        public.modality,
  modality_label  text,
  title           text,
  plan_kind       text,
  active          boolean,
  motivo          text,
  slot_id         uuid,
  override_id     uuid,
  template_id     uuid,
  template_slug   text,
  template_name   text,
  template_warmup text,
  template_note   text,
  est_minutes     integer,
  exercise_count  integer,
  session_id      uuid,
  session_status  text
)
language sql stable
security invoker
set search_path = ''
as $$
  select p.date, p.start_time, p.duration_min,
         (p.date + p.start_time) at time zone 'America/Sao_Paulo',
         (p.date + p.start_time + make_interval(mins => p.duration_min)) at time zone 'America/Sao_Paulo',
         p.modality, public.modality_label(p.modality), p.title, p.plan_kind, p.active, p.motivo,
         p.slot_id, p.override_id, p.template_id,
         wt.slug, wt.name, wt.warmup, wt.note, wt.est_minutes,
         (select count(*)::int from public.template_exercises te where te.template_id = p.template_id),
         ss.id, ss.status
  from public.plan_between(p_from, p_to) p
  left join public.workout_templates wt on wt.id = p.template_id
  left join lateral (
    select s.id, s.status from public.sessions s
    where p.active and s.date = p.date
      and (s.override_id = p.override_id
           or (s.slot_id = p.slot_id and s.override_id is null)
           or (s.modality = p.modality and s.template_id is not distinct from p.template_id))
    order by (s.override_id is not distinct from p.override_id and s.slot_id is not distinct from p.slot_id) desc,
             abs(extract(epoch from coalesce(s.started_at, s.created_at)
                 - ((p.date + p.start_time) at time zone 'America/Sao_Paulo')))
    limit 1
  ) ss on true
$$;

-- ---------------------------------------------------------------- operação
create view public.v_today with (security_invoker = true) as
  select * from public.plan_with_sessions(public.today_sp(), public.today_sp())
  order by start_time;

create view public.v_week with (security_invoker = true) as
  select extract(isodow from p.date)::int as weekday, p.*
  from public.plan_with_sessions(public.week_start(public.today_sp()),
                                 public.week_start(public.today_sp()) + 6) p
  order by p.date, p.start_time;

-- Últimas séries de cada exercício (sessão mais recente em que ele apareceu; sem aquecimento).
create view public.v_last_sets with (security_invoker = true) as
  with last as (
    select distinct on (sl.exercise_id) sl.exercise_id, sl.session_id, s.date
    from public.set_logs sl
    join public.sessions s on s.id = sl.session_id
    where not sl.warmup
    order by sl.exercise_id, s.date desc, sl.logged_at desc
  )
  select l.exercise_id, e.name as exercise_name, l.session_id, l.date,
         sl.set_number, sl.kg, sl.reps, sl.rir, sl.logged_at
  from last l
  join public.exercises e on e.id = l.exercise_id
  join public.set_logs sl on sl.session_id = l.session_id and sl.exercise_id = l.exercise_id and not sl.warmup
  order by e.name, sl.set_number;

-- ---------------------------------------------------------------- evolução: corpo
-- Média móvel de 7 dias por JANELA DE DATA (dias sem pesagem são ignorados, não viram zero).
create view public.v_weight_trend with (security_invoker = true) as
  with w as (
    select bm.date, bm.peso_kg,
           avg(bm.peso_kg) over win as avg_7d,
           count(*) over win as n_7d
    from public.body_metrics bm
    where bm.peso_kg is not null
    window win as (order by bm.date range between interval '6 days' preceding and current row)
  ),
  t as (
    select w.date, w.peso_kg, w.avg_7d, w.n_7d,
           p7.avg_7d as prev7, p28.avg_7d as prev28
    from w
    left join lateral (select x.avg_7d from w x where x.date between w.date - 10 and w.date - 7
                       order by x.date desc limit 1) p7 on true
    left join lateral (select x.avg_7d from w x where x.date between w.date - 35 and w.date - 28
                       order by x.date desc limit 1) p28 on true
  )
  select t.date, t.peso_kg,
         round(t.avg_7d, 2) as avg_7d,
         t.n_7d::int as n_7d,
         round(t.avg_7d - t.prev7, 2) as delta_7d,
         round(t.avg_7d - t.prev28, 2) as delta_28d,
         round((t.avg_7d - t.prev7) / t.prev7 * 100, 2) as pace_pct_week,
         round((t.avg_7d - t.prev28) / t.prev28 * 100 / 4, 2) as pace_pct_week_28d,
         g.max_loss_pct_week,
         coalesce(-(t.avg_7d - t.prev7) / t.prev7 * 100 > g.max_loss_pct_week, false) as above_cap
  from t
  left join lateral (select gg.max_loss_pct_week from public.goals gg limit 1) g on true
  order by t.date;

-- ---------------------------------------------------------------- evolução: força
-- 1RM estimado (Epley) por série válida: sem aquecimento, 1–12 reps, carga > 0.
create view public.v_e1rm with (security_invoker = true) as
  select sl.id as set_id, sl.session_id, s.date, sl.exercise_id, e.name as exercise_name, e.main_lift,
         sl.set_number, sl.kg, sl.reps, sl.logged_at,
         round(sl.kg * (1 + sl.reps / 30.0), 2) as e1rm
  from public.set_logs sl
  join public.sessions s on s.id = sl.session_id
  join public.exercises e on e.id = sl.exercise_id
  where not sl.warmup and sl.reps between 1 and 12 and sl.kg > 0;

-- Por sessão × exercício: top set (maior 1RM estimado), volume (Σ kg × reps) e PR de volume.
create view public.v_e1rm_session with (security_invoker = true) as
  with vol as (
    select sl.session_id, sl.exercise_id,
           count(*)::int as n_sets,
           sum(coalesce(sl.kg, 0) * sl.reps) as volume_kg
    from public.set_logs sl
    where not sl.warmup and sl.reps > 0
    group by sl.session_id, sl.exercise_id
  ),
  top as (
    select distinct on (v.session_id, v.exercise_id) v.session_id, v.exercise_id, v.kg, v.reps, v.e1rm
    from public.v_e1rm v
    order by v.session_id, v.exercise_id, v.e1rm desc, v.kg desc
  ),
  j as (
    select s.date, vol.session_id, vol.exercise_id, e.name as exercise_name, e.main_lift,
           vol.n_sets, vol.volume_kg, top.kg as top_kg, top.reps as top_reps, top.e1rm as top_e1rm,
           max(vol.volume_kg) over (partition by vol.exercise_id order by s.date, s.created_at
                                    rows between unbounded preceding and 1 preceding) as prev_best_volume
    from vol
    join public.sessions s on s.id = vol.session_id
    join public.exercises e on e.id = vol.exercise_id
    left join top on top.session_id = vol.session_id and top.exercise_id = vol.exercise_id
  )
  select j.*, coalesce(j.volume_kg > j.prev_best_volume, false) as is_volume_pr
  from j;

-- Cada série válida com flags de PR (supera o máximo anterior do exercício; a 1ª série é linha de base).
create view public.v_prs with (security_invoker = true) as
  with x as (
    select sl.id as set_id, sl.session_id, s.date, sl.exercise_id, e.name as exercise_name, e.main_lift,
           sl.set_number, sl.kg, sl.reps, sl.logged_at,
           case when sl.reps between 1 and 12 then round(sl.kg * (1 + sl.reps / 30.0), 2) end as e1rm
    from public.set_logs sl
    join public.sessions s on s.id = sl.session_id
    join public.exercises e on e.id = sl.exercise_id
    where not sl.warmup and sl.reps >= 1 and sl.kg > 0
  ),
  y as (
    select x.*,
           max(x.kg) over w as prev_best_kg,
           max(x.e1rm) over w as prev_best_e1rm
    from x
    window w as (partition by x.exercise_id order by x.date, x.logged_at, x.set_number
                 rows between unbounded preceding and 1 preceding)
  )
  select y.*,
         coalesce(y.kg > y.prev_best_kg, false) as is_load_pr,
         coalesce(y.e1rm > y.prev_best_e1rm, false) as is_e1rm_pr,
         coalesce(y.kg > y.prev_best_kg or y.e1rm > y.prev_best_e1rm, false) as is_pr
  from y;

-- Recordes atuais por exercício.
create view public.v_pr_bests with (security_invoker = true) as
  select e.id as exercise_id, e.name as exercise_name, e.main_lift,
         bk.kg as best_kg, bk.reps as best_kg_reps, bk.date as best_kg_date,
         be.e1rm as best_e1rm, be.kg as best_e1rm_kg, be.reps as best_e1rm_reps, be.date as best_e1rm_date,
         bv.volume_kg as best_volume_kg, bv.date as best_volume_date,
         (select max(p.date) from public.v_prs p where p.exercise_id = e.id and p.is_pr) as last_pr_date
  from public.exercises e
  left join lateral (select p.kg, p.reps, p.date from public.v_prs p where p.exercise_id = e.id
                     order by p.kg desc, p.reps desc, p.date limit 1) bk on true
  left join lateral (select p.e1rm, p.kg, p.reps, p.date from public.v_prs p
                     where p.exercise_id = e.id and p.e1rm is not null
                     order by p.e1rm desc, p.date limit 1) be on true
  left join lateral (select v.volume_kg, v.date from public.v_e1rm_session v where v.exercise_id = e.id
                     order by v.volume_kg desc, v.date limit 1) bv on true
  where bk.kg is not null or bv.volume_kg is not null;

-- ---------------------------------------------------------------- nutrição
create view public.v_daily_nutrition with (security_invoker = true) as
  with f as (
    select fl.date,
           sum(fl.kcal) as kcal, sum(fl.protein_g) as protein_g,
           sum(fl.carb_g) as carb_g, sum(fl.fat_g) as fat_g,
           count(*)::int as n_items, bool_or(fl.estimated) as has_estimated
    from public.food_logs fl
    group by fl.date
  ),
  d as (
    select f.date from f
    union
    select dc.date from public.daily_checks dc
  )
  select d.date,
         coalesce(f.kcal, 0) as kcal, coalesce(f.protein_g, 0) as protein_g,
         coalesce(f.carb_g, 0) as carb_g, coalesce(f.fat_g, 0) as fat_g,
         coalesce(f.n_items, 0) as n_items, coalesce(f.has_estimated, false) as has_estimated,
         f.date is not null as food_logged,
         coalesce(dc.creatine, false) as creatine, dc.creatine_g, dc.water_ml,
         g.kcal_target,
         w.ref_weight_kg,
         round(w.ref_weight_kg * g.protein_g_per_kg_min) as protein_target_min_g,
         round(w.ref_weight_kg * g.protein_g_per_kg_max) as protein_target_max_g,
         round(w.ref_weight_kg * g.water_ml_per_kg_min) as water_target_min_ml,
         round(w.ref_weight_kg * g.water_ml_per_kg_max) as water_target_max_ml
  from d
  left join f on f.date = d.date
  left join public.daily_checks dc on dc.date = d.date
  left join lateral (select gg.* from public.goals gg limit 1) g on true
  left join lateral (select coalesce(wt.avg_7d, wt.peso_kg) as ref_weight_kg from public.v_weight_trend wt
                     where wt.date <= d.date order by wt.date desc limit 1) w on true
  order by d.date;

-- ---------------------------------------------------------------- recomposição (card do Hoje)
create view public.v_recomposition with (security_invoker = true) as
  with today as (select public.today_sp() as d),
  w_now as (
    select wt.date, wt.avg_7d from public.v_weight_trend wt, today
    where wt.date between today.d - 7 and today.d order by wt.date desc limit 1
  ),
  w_prev as (
    select wt.date, wt.avg_7d from public.v_weight_trend wt, w_now
    where wt.date between w_now.date - 35 and w_now.date - 28 order by wt.date desc limit 1
  ),
  c_now as (
    select bm.date, bm.cintura_cm from public.body_metrics bm, today
    where bm.cintura_cm is not null and bm.date between today.d - 21 and today.d
    order by bm.date desc limit 1
  ),
  c_prev as (
    select bm.date, bm.cintura_cm from public.body_metrics bm, c_now
    where bm.cintura_cm is not null and bm.date between c_now.date - 42 and c_now.date - 21
    order by abs(bm.date - (c_now.date - 28)), bm.date desc limit 1
  ),
  f_ex as (
    select v.exercise_id,
           max(v.e1rm) filter (where v.date between today.d - 13 and today.d) as recent,
           max(v.e1rm) filter (where v.date between today.d - 41 and today.d - 28) as before
    from public.v_e1rm v, today
    where v.main_lift
    group by v.exercise_id
  ),
  f as (
    select count(*)::int as n,
           percentile_cont(0.5) within group (order by (recent - before) / before * 100) as median_pct
    from f_ex where recent is not null and before is not null
  ),
  r as (
    select w_now.avg_7d as weight_now_kg, w_prev.avg_7d as weight_prev_kg,
           round(w_now.avg_7d - w_prev.avg_7d, 2) as weight_delta_kg,
           round((w_now.avg_7d - w_prev.avg_7d) / w_prev.avg_7d * 100 / 4, 2) as weight_pace_pct_week,
           public.trend_arrow(w_now.avg_7d - w_prev.avg_7d, 0.3) as weight_arrow,
           c_now.cintura_cm as waist_now_cm, c_prev.cintura_cm as waist_prev_cm,
           round(c_now.cintura_cm - c_prev.cintura_cm, 1) as waist_delta_cm,
           public.trend_arrow(c_now.cintura_cm - c_prev.cintura_cm, 0.5) as waist_arrow,
           case when f.n > 0 then round(f.median_pct::numeric, 1) end as strength_delta_pct,
           f.n as strength_n_exercises,
           public.trend_arrow(case when f.n > 0 then f.median_pct::numeric end, 2) as strength_arrow,
           (select gg.max_loss_pct_week from public.goals gg limit 1) as max_loss_pct_week
    from (select 1) one
    left join w_now on true
    left join w_prev on true
    left join c_now on true
    left join c_prev on true
    cross join f
  ),
  k as (
    select r.*,
           case
             when r.waist_arrow = 'up' then 'alerta_cintura'
             when r.weight_arrow = 'down' and r.strength_arrow = 'down'
                  and -r.weight_pace_pct_week > coalesce(r.max_loss_pct_week, 0.5) then 'deficit_agressivo'
             when r.weight_arrow is null or r.waist_arrow is null or r.strength_arrow is null then 'coletando_dados'
             when r.weight_arrow = 'flat' and r.waist_arrow = 'flat' and r.strength_arrow = 'flat' then 'plato'
             when r.weight_arrow in ('down', 'flat') and r.waist_arrow = 'down'
                  and r.strength_arrow in ('up', 'flat') then 'no_rumo'
             else 'misto'
           end as reading
    from r
  )
  select k.*,
         case k.reading
           when 'alerta_cintura' then 'Atenção: a cintura subiu nas últimas ~4 semanas.'
           when 'deficit_agressivo' then 'Déficit agressivo demais: peso caindo rápido e força caindo. Vale subir as kcal.'
           when 'plato' then 'Platô: peso, cintura e força estáveis há ~4 semanas. Hora de revisar dieta e treino.'
           when 'no_rumo' then 'Recomposição no rumo.'
           when 'misto' then 'Sinais mistos. Acompanhar mais uma semana.'
           else 'Coletando dados: falta ' || concat_ws(', ',
                  case when k.weight_arrow is null then 'peso (média 7d de ~4 semanas)' end,
                  case when k.waist_arrow is null then 'cintura (~4 semanas)' end,
                  case when k.strength_arrow is null then 'força (cargas de ~4 semanas)' end) || '.'
         end as reading_text
  from k;

-- ---------------------------------------------------------------- aderência
-- Por modalidade (+ 'total'): semanas seguidas cumprindo o planejado. Feitas = sessões feito/parcial
-- na semana (independente do dia), então remarcação não quebra. Semana corrente só conta se já cumprida.
-- Semanas sem nada planejado são ignoradas.
create view public.v_streaks with (security_invoker = true) as
  with today as (select public.today_sp() as d, public.week_start(public.today_sp()) as cw),
  bounds as (
    select least(coalesce((select min(s.date) from public.sessions s), today.d), today.d) as first_day,
           today.d, today.cw
    from today
  ),
  plan as (
    select public.week_start(p.date) as ws, p.modality::text as modality, count(*)::int as n
    from bounds b, public.plan_between(public.week_start(b.first_day), b.cw + 6) p
    where p.active
    group by 1, 2
  ),
  done as (
    select public.week_start(s.date) as ws, s.modality::text as modality, count(*)::int as n
    from public.sessions s
    where s.status in ('feito', 'parcial')
    group by 1, 2
  ),
  mods as (select unnest(enum_range(null::public.modality))::text as modality),
  per_mod as (
    select w.ws, m.modality, coalesce(p.n, 0) as planned, coalesce(dn.n, 0) as done
    from bounds b
    cross join lateral generate_series(public.week_start(b.first_day)::timestamp, b.cw::timestamp, interval '7 days') g(t)
    cross join lateral (select g.t::date as ws) w
    cross join mods m
    left join plan p on p.ws = w.ws and p.modality = m.modality
    left join done dn on dn.ws = w.ws and dn.modality = m.modality
  ),
  weeks as (
    select ws, modality, planned, done from per_mod
    union all
    select ws, 'total', sum(planned)::int, sum(least(done, planned))::int from per_mod group by ws
  ),
  flagged as (
    select wk.*, (wk.planned > 0 and wk.done >= wk.planned) as met, (wk.ws = t.cw) as is_current
    from weeks wk, today t
  ),
  considered as (
    select f.*,
           sum(case when f.met then 0 else 1 end) over (partition by f.modality order by f.ws) as grp,
           row_number() over (partition by f.modality order by f.ws desc) as rn_desc
    from flagged f
    where f.planned > 0 and (not f.is_current or f.met)
  ),
  islands as (
    select modality, grp, count(*) filter (where met) as len
    from considered group by modality, grp
  ),
  cur as (
    select c.modality, case when c.met then i.len else 0 end as current_streak
    from considered c join islands i on i.modality = c.modality and i.grp = c.grp
    where c.rn_desc = 1
  ),
  misses as (
    select s.modality::text as modality,
           count(*) filter (where s.status in ('feito', 'parcial')
                            and s.date > coalesce(lm.last_miss, '-infinity'::date)) as sessions_since_miss
    from public.sessions s
    left join lateral (select max(s2.date) as last_miss from public.sessions s2
                       where s2.modality = s.modality and s2.status = 'faltou') lm on true
    group by s.modality
  )
  select m.modality,
         coalesce(cur.current_streak, 0)::int as current_streak_weeks,
         coalesce((select max(i.len) from islands i where i.modality = m.modality), 0)::int as best_streak_weeks,
         (select count(*) from considered c where c.modality = m.modality)::int as weeks_tracked,
         coalesce((select f.planned from flagged f where f.modality = m.modality and f.is_current), 0) as this_week_planned,
         coalesce((select f.done from flagged f where f.modality = m.modality and f.is_current), 0) as this_week_done,
         case when m.modality = 'total' then (select sum(ms.sessions_since_miss) from misses ms)
              else (select ms.sessions_since_miss from misses ms where ms.modality = m.modality) end::int
           as sessions_since_miss
  from (select modality from mods union all select 'total') m
  left join cur on cur.modality = m.modality;

-- ---------------------------------------------------------------- resumos semana / mês
create or replace function public.period_summary(p_unit text)
returns table (
  period_start      date,
  period_end        date,
  planned           integer,
  done              integer,
  by_modality       jsonb,
  n_sets            integer,
  volume_kg         numeric,
  n_prs             integer,
  days_logged       integer,
  days_in_period    integer,
  kcal_avg          numeric,
  protein_avg_g     numeric,
  kcal_target       integer,
  protein_target_min_g numeric,
  protein_target_max_g numeric,
  weight_avg7_end   numeric,
  weight_delta_kg   numeric,
  waist_last_cm     numeric,
  creatine_days     integer
)
language sql stable
security invoker
set search_path = ''
as $$
  with today as (select public.today_sp() as d),
  first_day as (
    select least(
      coalesce((select min(s.date) from public.sessions s), t.d),
      coalesce((select min(b.date) from public.body_metrics b), t.d),
      coalesce((select min(f.date) from public.food_logs f), t.d),
      t.d) as d
    from today t
  ),
  periods as (
    select g::date as ps,
           (g + case p_unit when 'month' then interval '1 month' else interval '7 days' end)::date - 1 as pe
    from first_day fd, today t,
         generate_series(date_trunc(p_unit, fd.d::timestamp), date_trunc(p_unit, t.d::timestamp),
                         case p_unit when 'month' then interval '1 month' else interval '7 days' end) g
  ),
  plan as (
    select pr.ps, p.modality::text as modality, count(*)::int as n
    from periods pr
    join lateral public.plan_between(pr.ps, pr.pe) p on true
    where p.active
    group by 1, 2
  ),
  done as (
    select pr.ps, s.modality::text as modality, count(*)::int as n
    from periods pr join public.sessions s on s.date between pr.ps and pr.pe
    where s.status in ('feito', 'parcial')
    group by 1, 2
  ),
  mod as (
    select coalesce(p.ps, d.ps) as ps, coalesce(p.modality, d.modality) as modality,
           coalesce(p.n, 0) as planned, coalesce(d.n, 0) as done
    from plan p full join done d on d.ps = p.ps and d.modality = p.modality
  ),
  modagg as (
    select ps, sum(planned)::int as planned, sum(least(done, planned))::int as done,
           jsonb_object_agg(modality, jsonb_build_object('planned', planned, 'done', done)) as by_modality
    from mod group by ps
  )
  select pr.ps, pr.pe,
         coalesce(ma.planned, 0), coalesce(ma.done, 0), coalesce(ma.by_modality, '{}'::jsonb),
         coalesce(tr.n_sets, 0), coalesce(tr.volume_kg, 0), coalesce(prs.n, 0),
         coalesce(nu.days_logged, 0),
         (pr.pe - pr.ps + 1),
         round(nu.kcal_avg), round(nu.protein_avg, 1),
         g.kcal_target,
         round(wend.avg_7d * g.protein_g_per_kg_min), round(wend.avg_7d * g.protein_g_per_kg_max),
         wend.avg_7d,
         round(wend.avg_7d - wprev.avg_7d, 2),
         waist.cintura_cm,
         coalesce(cr.n, 0)
  from periods pr
  left join modagg ma on ma.ps = pr.ps
  left join lateral (
    select count(*)::int as n_sets, sum(coalesce(sl.kg, 0) * sl.reps) as volume_kg
    from public.set_logs sl join public.sessions s on s.id = sl.session_id
    where not sl.warmup and sl.reps > 0 and s.date between pr.ps and pr.pe
  ) tr on true
  left join lateral (
    select count(*)::int as n from public.v_prs p where p.is_pr and p.date between pr.ps and pr.pe
  ) prs on true
  left join lateral (
    select count(*)::int as days_logged, avg(dn.kcal) as kcal_avg, avg(dn.protein_g) as protein_avg
    from public.v_daily_nutrition dn
    where dn.food_logged and dn.date between pr.ps and pr.pe
  ) nu on true
  left join lateral (select gg.* from public.goals gg limit 1) g on true
  left join lateral (select wt.avg_7d from public.v_weight_trend wt where wt.date between pr.ps and pr.pe
                     order by wt.date desc limit 1) wend on true
  left join lateral (select wt.avg_7d from public.v_weight_trend wt where wt.date < pr.ps
                     order by wt.date desc limit 1) wprev on true
  left join lateral (select bm.cintura_cm from public.body_metrics bm
                     where bm.cintura_cm is not null and bm.date between pr.ps and pr.pe
                     order by bm.date desc limit 1) waist on true
  left join lateral (select count(*)::int as n from public.daily_checks dc
                     where dc.creatine and dc.date between pr.ps and pr.pe) cr on true
  order by pr.ps
$$;

create view public.v_weekly_summary with (security_invoker = true) as
  select extract(isoyear from s.period_start)::int as iso_year,
         extract(week from s.period_start)::int as iso_week,
         s.*
  from public.period_summary('week') s;

create view public.v_monthly_summary with (security_invoker = true) as
  select s.*,
         bf.first_metrics, bl.last_metrics,
         coalesce(ph.n, 0)::int as n_photos
  from public.period_summary('month') s
  left join lateral (
    select jsonb_strip_nulls(jsonb_build_object(
             'peso_kg',     (select bm.peso_kg     from public.body_metrics bm where bm.peso_kg     is not null and bm.date between s.period_start and s.period_end order by bm.date limit 1),
             'cintura_cm',  (select bm.cintura_cm  from public.body_metrics bm where bm.cintura_cm  is not null and bm.date between s.period_start and s.period_end order by bm.date limit 1),
             'abdomen_cm',  (select bm.abdomen_cm  from public.body_metrics bm where bm.abdomen_cm  is not null and bm.date between s.period_start and s.period_end order by bm.date limit 1),
             'quadril_cm',  (select bm.quadril_cm  from public.body_metrics bm where bm.quadril_cm  is not null and bm.date between s.period_start and s.period_end order by bm.date limit 1),
             'peito_cm',    (select bm.peito_cm    from public.body_metrics bm where bm.peito_cm    is not null and bm.date between s.period_start and s.period_end order by bm.date limit 1),
             'braco_cm',    (select bm.braco_cm    from public.body_metrics bm where bm.braco_cm    is not null and bm.date between s.period_start and s.period_end order by bm.date limit 1),
             'coxa_cm',     (select bm.coxa_cm     from public.body_metrics bm where bm.coxa_cm     is not null and bm.date between s.period_start and s.period_end order by bm.date limit 1),
             'gordura_pct', (select bm.gordura_pct from public.body_metrics bm where bm.gordura_pct is not null and bm.date between s.period_start and s.period_end order by bm.date limit 1)
           )) as first_metrics
  ) bf on true
  left join lateral (
    select jsonb_strip_nulls(jsonb_build_object(
             'peso_kg',     (select bm.peso_kg     from public.body_metrics bm where bm.peso_kg     is not null and bm.date between s.period_start and s.period_end order by bm.date desc limit 1),
             'cintura_cm',  (select bm.cintura_cm  from public.body_metrics bm where bm.cintura_cm  is not null and bm.date between s.period_start and s.period_end order by bm.date desc limit 1),
             'abdomen_cm',  (select bm.abdomen_cm  from public.body_metrics bm where bm.abdomen_cm  is not null and bm.date between s.period_start and s.period_end order by bm.date desc limit 1),
             'quadril_cm',  (select bm.quadril_cm  from public.body_metrics bm where bm.quadril_cm  is not null and bm.date between s.period_start and s.period_end order by bm.date desc limit 1),
             'peito_cm',    (select bm.peito_cm    from public.body_metrics bm where bm.peito_cm    is not null and bm.date between s.period_start and s.period_end order by bm.date desc limit 1),
             'braco_cm',    (select bm.braco_cm    from public.body_metrics bm where bm.braco_cm    is not null and bm.date between s.period_start and s.period_end order by bm.date desc limit 1),
             'coxa_cm',     (select bm.coxa_cm     from public.body_metrics bm where bm.coxa_cm     is not null and bm.date between s.period_start and s.period_end order by bm.date desc limit 1),
             'gordura_pct', (select bm.gordura_pct from public.body_metrics bm where bm.gordura_pct is not null and bm.date between s.period_start and s.period_end order by bm.date desc limit 1)
           )) as last_metrics
  ) bl on true
  left join lateral (
    select count(*) as n from public.progress_photos pp
    where pp.date between s.period_start and s.period_end
  ) ph on true;
