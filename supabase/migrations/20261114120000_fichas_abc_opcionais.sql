-- Fichas ABC únicas (14/11/2026, pedido do Kaluan): longas e curtas viram a mesma ficha A, B ou C.
-- Sem apagar histórico: fichas antigas ficam no banco (sessões antigas apontam para elas), só saem da lista.
-- E cada exercício pode ser marcado como opcional (pode pular) ou ter as últimas séries opcionais.

alter table public.workout_templates
  add column if not exists active boolean not null default true;
comment on column public.workout_templates.active is
  'false = ficha aposentada: some da lista de fichas do app, mas segue no banco para o histórico.';

alter table public.template_exercises
  add column if not exists optional boolean not null default false;
comment on column public.template_exercises.optional is
  'Exercício que pode ser pulado se faltar tempo ou a recuperação piorar (só da versão longa ou primeiro na ordem de corte).';

alter table public.template_exercises
  add column if not exists optional_sets smallint not null default 0;
comment on column public.template_exercises.optional_sets is
  'Quantas das últimas séries podem sair primeiro (ex.: 1 = a 3ª de 3). 0 = todas contam.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'template_exercises_optional_sets_check') then
    alter table public.template_exercises
      add constraint template_exercises_optional_sets_check check (optional_sets >= 0 and optional_sets < sets);
  end if;
end $$;
