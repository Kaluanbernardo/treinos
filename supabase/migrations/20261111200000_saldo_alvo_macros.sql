-- Saldo-alvo fixo + permissão do dia, diário incompleto e faixas de carboidrato e gordura (11/11/2026).
-- Só aditiva: colunas novas em goals e daily_checks e uma view nova (v_day_targets). As views antigas não mudam.
--
-- 1. Meta calórica (docs/calorias.md): a meta do dia é um SALDO fixo, treine ou não: saldo-alvo = −goals.deficit_kcal,
--    já exposto como v_energy_daily.target_balance_kcal. Decisão do Kaluan em 11/11/2026: −300 kcal/dia (déficit).
--    O treino muda a PERMISSÃO, não a meta: pode consumir = basal + rotina + exercício feito + saldo-alvo
--    (= gasto − 300). O saldo real do dia continua comida − gasto (zero = manutenção); comida − permissão é o saldo
--    contra a meta.
-- 2. Diário incompleto: daily_checks.diary_incomplete, marcado pelo assistente (`fit diario incompleto <data>`) quando o
--    Kaluan avisa que faltou registrar refeição, ou quando o dia é um placeholder. O dia sai do saldo acumulado e das
--    médias de macros, e aparece nomeado no app. Nunca é deduzido por heurística.
-- 3. Carboidrato e gordura por zonas, como a proteína (docs/macros.md, com as fontes):
--    gordura  = % da permissão do dia: abaixo < 15 % ≤ mínimo ok < 20 % ≤ ideal ≤ 35 % < acima
--    carbo    = abaixo < 130 g (RDA) ≤ mínimo ok < ideal ≤ … ≤ acima, com a faixa ideal = o que sobra na permissão
--               depois das faixas de proteína e gordura:
--                 início = (permissão × (1 − 35 %) − 4 × teto útil da proteína) / 4
--                 fim    = (permissão × (1 − 20 %) − 4 × ideal da proteína) / 4
--               (nunca abaixo de 130 g). Treinar aumenta a permissão e, com ela, o espaço do carboidrato.

-- ---------------------------------------------------------------- parâmetros (goals)
alter table public.goals add column if not exists fat_floor_pct numeric(4,1) not null default 15
  check (fat_floor_pct between 5 and 40);
alter table public.goals add column if not exists fat_min_pct numeric(4,1) not null default 20
  check (fat_min_pct between 5 and 45);
alter table public.goals add column if not exists fat_max_pct numeric(4,1) not null default 35
  check (fat_max_pct between 10 and 50);
alter table public.goals add column if not exists carb_floor_g integer not null default 130
  check (carb_floor_g between 50 and 400);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'goals_fat_pct_order') then
    alter table public.goals add constraint goals_fat_pct_order check (fat_floor_pct <= fat_min_pct and fat_min_pct <= fat_max_pct);
  end if;
end $$;

-- saldo-alvo −300 (deficit_kcal 300). Só troca o 0 da migração 20261105120000; um valor já configurado diferente fica.
update public.goals
   set deficit_kcal = 300,
       note = 'Meta do dia = saldo −300 kcal, fixa (treine ou não). Pode consumir = basal + rotina + exercício − 300. Regra em docs/calorias.md.'
 where deficit_kcal = 0;
alter table public.goals alter column deficit_kcal set default 300;

comment on column public.goals.deficit_kcal is
  'Saldo-alvo do dia = −deficit_kcal (300 = déficit de 300 kcal; 0 = manutenção). Fixo, treine ou não: o treino aumenta a permissão (gasto + saldo-alvo), não a meta. Mudar com `fit saldo-alvo`. docs/calorias.md';
comment on column public.goals.fat_floor_pct is 'Gordura: abaixo disto (% da permissão do dia) é "abaixo do mínimo" (Helms 2014: 15–30 % em preparação). docs/macros.md';
comment on column public.goals.fat_min_pct is 'Gordura: início da faixa ideal, % da permissão (ACSM 2016 / IOM: 20 %). docs/macros.md';
comment on column public.goals.fat_max_pct is 'Gordura: fim da faixa ideal, % da permissão (ACSM 2016 / IOM: 35 %). docs/macros.md';
comment on column public.goals.carb_floor_g is 'Carboidrato: mínimo em g/dia (RDA do IOM, 130 g). A faixa ideal é o espaço que sobra na permissão. docs/macros.md';

-- ---------------------------------------------------------------- diário incompleto (daily_checks)
alter table public.daily_checks add column if not exists diary_incomplete boolean not null default false;
comment on column public.daily_checks.diary_incomplete is
  'O diário alimentar do dia ficou incompleto (dito pelo Kaluan ou dia placeholder): o dia sai do saldo acumulado e das médias. `fit diario incompleto|completo <data>`.';

-- ---------------------------------------------------------------- metas do dia
-- 1 linha por dia de v_energy_daily (do 1º dado até hoje). day_state diz se o dia entra nas somas:
--   hoje (em andamento) · incompleto (marcado) · sem_refeicao · sem_basal · na_conta.
-- Proteína pela faixa atual de v_protein_target (mesmo peso de referência, IMC ≤ 30).
create or replace view public.v_day_targets with (security_invoker = true) as
  with g as (select gg.* from public.goals gg limit 1),
  p as (select pt.* from public.v_protein_target pt),
  base as (
    select e.date, e.target_balance_kcal, e.bmr_kcal, e.daily_life_kcal, e.exercise_kcal, e.is_estimate, e.out_kcal,
           e.food_logged, e.food_kcal, e.food_has_estimated, e.balance_kcal,
           coalesce(dc.diary_incomplete, false) as diary_incomplete,
           case when e.out_kcal is not null then e.out_kcal + coalesce(e.target_balance_kcal, 0) else g.kcal_target end as allowance_kcal,
           case when e.out_kcal is not null then 'gasto' when g.kcal_target is not null then 'fixa' end as allowance_basis,
           round(coalesce(n.protein_g, 0), 1) as protein_g,
           round(coalesce(n.carb_g, 0), 1) as carb_g,
           round(coalesce(n.fat_g, 0), 1) as fat_g,
           p.ref_weight_kg, p.min_g as protein_min_g, p.ideal_g as protein_ideal_g, p.cap_g as protein_cap_g,
           g.fat_floor_pct, g.fat_min_pct, g.fat_max_pct, g.carb_floor_g
    from public.v_energy_daily e
    left join g on true
    left join p on true
    left join public.v_daily_nutrition n on n.date = e.date
    left join public.daily_checks dc on dc.date = e.date
  ),
  b as (
    select base.*,
           case when base.date = public.today_sp() then 'hoje'
                when base.diary_incomplete then 'incompleto'
                when not base.food_logged then 'sem_refeicao'
                when base.balance_kcal is null then 'sem_basal'
                else 'na_conta' end as day_state,
           round(base.allowance_kcal * base.fat_floor_pct / 900)::int as fat_floor_g,
           round(base.allowance_kcal * base.fat_min_pct / 900)::int as fat_min_g,
           round(base.allowance_kcal * base.fat_max_pct / 900)::int as fat_max_g,
           round((base.allowance_kcal * (100 - base.fat_max_pct) - 400 * base.protein_cap_g) / 400)::int as carb_lo,
           round((base.allowance_kcal * (100 - base.fat_min_pct) - 400 * base.protein_ideal_g) / 400)::int as carb_hi
    from base
  ),
  c as (
    select b.*,
           -- greatest() ignora NULL: sem permissão ou sem faixa de proteína, sem faixa de carbo
           case when b.carb_lo is not null then greatest(b.carb_floor_g, b.carb_lo) end as carb_min_g,
           case when b.carb_lo is not null then greatest(b.carb_floor_g, b.carb_lo, b.carb_hi) end as carb_max_g
    from b
  )
  select c.date, c.day_state, c.diary_incomplete,
         c.target_balance_kcal, c.bmr_kcal, c.daily_life_kcal, c.exercise_kcal, c.is_estimate, c.out_kcal,
         c.allowance_kcal, c.allowance_basis,
         c.food_logged, c.food_kcal, c.food_has_estimated,
         case when c.allowance_kcal is not null then c.allowance_kcal - c.food_kcal end as remaining_kcal,
         c.balance_kcal,
         case when c.food_logged and c.out_kcal is not null then c.food_kcal - c.allowance_kcal end as balance_vs_target_kcal,
         c.protein_g, c.carb_g, c.fat_g,
         c.ref_weight_kg, c.protein_min_g, c.protein_ideal_g, c.protein_cap_g,
         c.fat_floor_g, c.fat_min_g, c.fat_max_g,
         c.carb_floor_g, c.carb_min_g, c.carb_max_g,
         case when not c.food_logged or c.diary_incomplete or c.protein_min_g is null then null
              when c.protein_g < c.protein_min_g then 'abaixo' when c.protein_g < c.protein_ideal_g then 'ok'
              when c.protein_g <= c.protein_cap_g then 'ideal' else 'acima' end as protein_zone,
         case when not c.food_logged or c.diary_incomplete or c.fat_floor_g is null then null
              when c.fat_g < c.fat_floor_g then 'abaixo' when c.fat_g < c.fat_min_g then 'ok'
              when c.fat_g <= c.fat_max_g then 'ideal' else 'acima' end as fat_zone,
         case when not c.food_logged or c.diary_incomplete or c.carb_min_g is null then null
              when c.carb_g < c.carb_floor_g then 'abaixo' when c.carb_g < c.carb_min_g then 'ok'
              when c.carb_g <= c.carb_max_g then 'ideal' else 'acima' end as carb_zone
  from c
  order by c.date;

revoke all on public.v_day_targets from public, anon;
grant select on public.v_day_targets to authenticated, bot;
