-- Passos do dia (relógio/celular), informados no chat e gravados com `fit steps`.
--   * só exibição (aba Calorias e Hoje): NÃO entram no gasto. A rotina segue basal × (activity_factor − 1);
--     NEAT por passos é ideia futura, ver docs/calorias.md.
--   * NULL = sem leitura no dia (diferente de 0 passos).
alter table public.daily_checks add column if not exists steps integer;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'daily_checks_steps_check') then
    alter table public.daily_checks add constraint daily_checks_steps_check check (steps >= 0);
  end if;
end $$;
