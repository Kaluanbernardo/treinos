-- F3 · Nutrição: busca de alimentos para o bot (sem acento + trigram), metas de macros e v_nutrition_targets.
-- Os dados da TACO entram na migration seguinte (20261028120100_taco.sql).

create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- unaccent "imutável" (necessário para índice de expressão)
create or replace function public.f_unaccent(t text)
returns text
language sql immutable parallel safe strict
set search_path = ''
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, t) $$;

create index if not exists foods_name_norm_trgm
  on public.foods using gin (public.f_unaccent(lower(name)) extensions.gin_trgm_ops);

-- Busca para o bot: todas as palavras precisam aparecer (sem acento), ou similaridade alta.
-- Custom (marmitas, receitas do Kaluan) primeiro, depois prefixo, similaridade e nome mais curto.
create or replace function public.food_search(q text, n integer default 8)
returns table (code text, name text, kcal numeric, protein_g numeric, carb_g numeric, fat_g numeric, portions text)
language sql stable
security invoker
set search_path = ''
as $$
  with x as (select public.f_unaccent(lower(trim(q))) as qq),
  f as (
    select fo.*, m.nn,
           not exists (select 1 from unnest(string_to_array(x.qq, ' ')) w where w <> '' and m.nn not like '%' || w || '%') as all_words,
           extensions.word_similarity(x.qq, m.nn) as sim,
           m.nn like x.qq || '%' as prefix
    from public.foods fo, x, lateral (select public.f_unaccent(lower(fo.name)) as nn) m
  )
  select f.code, f.name, f.kcal, f.protein_g, f.carb_g, f.fat_g,
         (select string_agg(fp.label || ' = ' || trim(to_char(fp.grams, 'FM999990.##')) || ' g', '; ' order by fp.grams)
          from public.food_portions fp where fp.food_id = f.id)
  from f
  where f.all_words or f.sim > 0.5
  order by f.is_custom desc, f.all_words desc, f.prefix desc, f.sim desc, length(f.name)
  limit greatest(1, least(n, 50))
$$;

-- Gordura por kg (faixa) para o anel de gordura; carbo = o que sobra das kcal-alvo.
alter table public.goals add column if not exists fat_g_per_kg_min numeric(3,1) not null default 0.8;
alter table public.goals add column if not exists fat_g_per_kg_max numeric(3,1) not null default 1.0;

-- Metas do dia (1 linha). Peso de referência = média 7d mais recente (ou a última pesagem, ou o peso das metas).
drop view if exists public.v_nutrition_targets;
create view public.v_nutrition_targets with (security_invoker = true) as
  with g as (select * from public.goals limit 1),
  w as (
    select coalesce(
      (select coalesce(wt.avg_7d, wt.peso_kg) from public.v_weight_trend wt order by wt.date desc limit 1),
      (select g.peso_ref_kg from g)) as ref
  )
  select g.kcal_target,
         round(w.ref, 1) as ref_weight_kg,
         round(w.ref * g.protein_g_per_kg_min)::int as protein_min_g,
         round(w.ref * g.protein_g_per_kg_max)::int as protein_max_g,
         round(w.ref * g.fat_g_per_kg_min)::int as fat_min_g,
         round(w.ref * g.fat_g_per_kg_max)::int as fat_max_g,
         case when g.kcal_target is not null then
           greatest(0, round((g.kcal_target
                              - w.ref * (g.protein_g_per_kg_min + g.protein_g_per_kg_max) / 2 * 4
                              - w.ref * (g.fat_g_per_kg_min + g.fat_g_per_kg_max) / 2 * 9) / 4))::int
         end as carb_target_g,
         g.creatine_g_min, g.creatine_g_max,
         round(w.ref * g.water_ml_per_kg_min)::int as water_min_ml,
         round(w.ref * g.water_ml_per_kg_max)::int as water_max_ml
  from g, w;

revoke all on public.v_nutrition_targets from public, anon;
grant select on public.v_nutrition_targets to authenticated, bot;
revoke execute on function public.food_search(text, integer), public.f_unaccent(text) from public, anon;
grant execute on function public.food_search(text, integer), public.f_unaccent(text) to authenticated, bot;
grant usage on schema extensions to bot;
