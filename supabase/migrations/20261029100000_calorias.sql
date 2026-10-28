-- Calorias: gasto (basal + rotina + exercício) × consumo, por dia.
--   * profile: 1 linha com altura, nascimento e sexo (todos NULL até o Kaluan informar; nunca inventados)
--     e o fator "rotina" aplicado sobre o basal (padrão 1,20; ver docs/calorias.md).
--   * exercise_kcal: kcal ATIVAS do relógio por sessão (session_id) ou por dia (sem sessão).
--   * modality_met(): MET por modalidade, usado só para estimar sessões sem leitura do relógio.
--   * v_energy_daily: 1 linha por dia, do primeiro dado até hoje. Basal = Mifflin-St Jeor com o último
--     peso até a data; NULL se faltar altura, idade ou sexo (o app pede esses dados em Configurações).

-- ---------------------------------------------------------------- perfil
create table if not exists public.profile (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  source           text not null default 'app' check (source in ('app', 'bot')),
  singleton        boolean not null default true unique check (singleton),
  height_cm        numeric(4,1) check (height_cm between 100 and 250),
  birth_date       date check (birth_date > '1900-01-01'),
  sex              text check (sex in ('M', 'F')),
  activity_factor  numeric(3,2) not null default 1.20 check (activity_factor between 1.00 and 1.60)
);
insert into public.profile (singleton) values (true) on conflict (singleton) do nothing;

-- ---------------------------------------------------------------- kcal do relógio
create table if not exists public.exercise_kcal (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  source      text not null default 'relogio' check (source in ('relogio', 'app', 'bot')),
  date        date not null default public.today_sp(),
  session_id  uuid references public.sessions (id) on delete set null,
  kcal        integer not null check (kcal > 0 and kcal < 5000),
  note        text
);
create index if not exists exercise_kcal_date_idx on public.exercise_kcal (date);
-- uma leitura por sessão (o CLI faz upsert); leituras do dia sem sessão podem ser várias
create unique index if not exists exercise_kcal_session_uidx on public.exercise_kcal (session_id) where session_id is not null;

do $$
declare t text;
begin
  foreach t in array array['profile', 'exercise_kcal'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated, bot', t);
    execute format('grant select, insert, update on public.%I to authenticated, bot', t);
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format('create policy owner_all on public.%I for all to authenticated
                    using ((select public.is_owner())) with check ((select public.is_owner()))', t);
    execute format('drop policy if exists bot_all on public.%I', t);
    execute format('create policy bot_all on public.%I for all to bot using (true) with check (true)', t);
  end loop;
end $$;
grant delete on public.exercise_kcal to authenticated, bot;

-- ---------------------------------------------------------------- MET por modalidade (Compendium of Physical Activities)
create or replace function public.modality_met(m public.modality)
returns numeric
language sql immutable
set search_path = ''
as $$
  select case m
    when 'musculacao' then 5.0   -- musculação vigorosa, com descanso entre séries
    when 'muay_thai'  then 10.0  -- artes marciais, ritmo moderado a intenso
    when 'jiu_jitsu'  then 8.0
    when 'cross'      then 8.0   -- circuito vigoroso
    when 'funcional'  then 6.0
  end
$$;

-- ---------------------------------------------------------------- energia por dia
drop view if exists public.v_energy_daily;
create view public.v_energy_daily with (security_invoker = true) as
  with p as (select pr.* from public.profile pr limit 1),
  g as (select gg.deficit_kcal, gg.peso_ref_kg from public.goals gg limit 1),
  d0 as (
    select least(
      (select min(fl.date) from public.food_logs fl),
      (select min(s.date) from public.sessions s where s.status in ('feito', 'parcial')),
      (select min(e.date) from public.exercise_kcal e),
      (select min(bm.date) from public.body_metrics bm where bm.peso_kg is not null)) as d
  ),
  days as (
    select gs::date as date
    from d0, generate_series(least(d0.d, public.today_sp()), public.today_sp(), interval '1 day') gs
    where d0.d is not null
  ),
  dw as (
    select dd.date,
           coalesce((select bm.peso_kg from public.body_metrics bm
                     where bm.peso_kg is not null and bm.date <= dd.date order by bm.date desc limit 1),
                    (select g.peso_ref_kg from g)) as weight_kg,
           p.height_cm, p.sex, coalesce(p.activity_factor, 1.20) as activity_factor,
           case when p.birth_date <= dd.date then extract(year from age(dd.date, p.birth_date))::int end as age_years
    from days dd left join p on true
  ),
  -- sessões feitas sem leitura do relógio: (MET − 1) × kg × h, ou seja, só o gasto acima do repouso
  sess as (
    select s.id, s.date, s.modality,
           least(180, coalesce(
             case when s.ended_at > s.started_at then extract(epoch from s.ended_at - s.started_at) / 60 end,
             ov.duration_min, sl.duration_min, wt.est_minutes, 60))::numeric as minutes
    from public.sessions s
    left join public.schedule_overrides ov on ov.id = s.override_id
    left join public.schedule_slots sl on sl.id = s.slot_id
    left join public.workout_templates wt on wt.id = s.template_id
    where s.status in ('feito', 'parcial')
      and not exists (select 1 from public.exercise_kcal e where e.session_id = s.id)
  ),
  est as (
    select x.date, count(*)::int as n,
           sum(round((public.modality_met(x.modality) - 1) * dw.weight_kg * x.minutes / 60))::int as kcal
    from sess x join dw on dw.date = x.date
    group by x.date
  ),
  wk as (
    select e.date, sum(e.kcal)::int as kcal, bool_or(e.session_id is null) as has_day_total
    from public.exercise_kcal e group by e.date
  ),
  f as (
    select fl.date, round(sum(fl.kcal))::int as kcal, bool_or(fl.estimated) as has_estimated
    from public.food_logs fl group by fl.date
  ),
  calc as (
    select dw.*,
           case when dw.weight_kg is not null and dw.height_cm is not null and dw.age_years is not null and dw.sex is not null
                then round(10 * dw.weight_kg + 6.25 * dw.height_cm - 5 * dw.age_years
                           + case dw.sex when 'M' then 5 else -161 end)::int end as bmr,
           coalesce(wk.kcal, 0) as watch,
           -- uma leitura do dia inteiro (sem sessão) já cobre todos os treinos do dia: sem estimativa
           case when coalesce(wk.has_day_total, false) then 0 else coalesce(est.kcal, 0) end as estimate,
           case when coalesce(wk.has_day_total, false) then 0 else coalesce(est.n, 0) end as n_est,
           f.kcal as food, f.has_estimated as food_est
    from dw
    left join wk on wk.date = dw.date
    left join est on est.date = dw.date
    left join f on f.date = dw.date
  )
  select c.date,
         round(c.weight_kg, 1) as weight_kg,
         c.height_cm, c.age_years, c.sex, c.activity_factor,
         c.bmr as bmr_kcal,
         round(c.bmr * (c.activity_factor - 1))::int as daily_life_kcal,
         c.watch as exercise_watch_kcal,
         c.estimate as exercise_est_kcal,
         c.watch + c.estimate as exercise_kcal,
         c.estimate > 0 as is_estimate,
         c.n_est as n_sessions_estimated,
         coalesce(c.food, 0) as food_kcal,
         c.food is not null as food_logged,
         coalesce(c.food_est, false) as food_has_estimated,
         c.bmr + round(c.bmr * (c.activity_factor - 1))::int + c.watch + c.estimate as out_kcal,
         case when c.food is not null and c.bmr is not null
              then c.food - (c.bmr + round(c.bmr * (c.activity_factor - 1))::int + c.watch + c.estimate) end as balance_kcal,
         -(select g.deficit_kcal from g) as target_balance_kcal,
         array_remove(array[
           case when c.height_cm is null then 'altura' end,
           case when c.age_years is null then 'data de nascimento' end,
           case when c.sex is null then 'sexo' end,
           case when c.weight_kg is null then 'peso' end], null) as bmr_missing
  from calc c
  order by c.date;

revoke all on public.v_energy_daily from public, anon;
grant select on public.v_energy_daily to authenticated, bot;
revoke execute on function public.modality_met(public.modality) from public, anon;
grant execute on function public.modality_met(public.modality) to authenticated, bot;
