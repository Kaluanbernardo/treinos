-- Peso de referência nas metas + alvo de proteína em gramas (calculado a partir de g/kg).
alter table public.goals add column if not exists peso_ref_kg numeric(5,2) check (peso_ref_kg > 0);
alter table public.goals add column if not exists protein_g_min integer
  generated always as (round(peso_ref_kg * protein_g_per_kg_min)::integer) stored;
alter table public.goals add column if not exists protein_g_max integer
  generated always as (round(peso_ref_kg * protein_g_per_kg_max)::integer) stored;
