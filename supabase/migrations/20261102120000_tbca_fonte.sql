-- TBCA · coluna foods.fonte ('TACO' | 'TBCA' | 'custom') e food_search priorizando TBCA (TACO como reserva).
-- Alimentos da TBCA entram sob demanda via `fit tbca` (scripts/fit), sem import em massa.

alter table public.foods add column if not exists fonte text;
update public.foods set fonte = case when is_custom then 'custom' when code like 'taco:%' then 'TACO' end
 where fonte is null;
alter table public.foods drop constraint if exists foods_fonte_check;
alter table public.foods add constraint foods_fonte_check check (fonte in ('TACO', 'TBCA', 'custom'));

-- Mesma busca de antes (todas as palavras sem acento, ou similaridade alta), agora devolvendo a fonte.
-- Ordem: custom primeiro, depois todas as palavras, TBCA antes de TACO, prefixo, similaridade, nome mais curto.
drop function if exists public.food_search(text, integer);
create function public.food_search(q text, n integer default 8)
returns table (code text, name text, fonte text, kcal numeric, protein_g numeric, carb_g numeric, fat_g numeric, portions text)
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
  select f.code, f.name, coalesce(f.fonte, case when f.is_custom then 'custom' end), f.kcal, f.protein_g, f.carb_g, f.fat_g,
         (select string_agg(fp.label || ' = ' || trim(to_char(fp.grams, 'FM999990.##')) || ' g', '; ' order by fp.grams)
          from public.food_portions fp where fp.food_id = f.id)
  from f
  where f.all_words or f.sim > 0.5
  order by f.is_custom desc, f.all_words desc, coalesce(f.fonte = 'TBCA', false) desc, f.prefix desc, f.sim desc, length(f.name)
  limit greatest(1, least(n, 50))
$$;

revoke execute on function public.food_search(text, integer) from public, anon;
grant execute on function public.food_search(text, integer) to authenticated, bot;
