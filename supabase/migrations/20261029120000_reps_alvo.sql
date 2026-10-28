-- Alvo de repetições por exercício da ficha (o app pré-preenche a próxima sessão).
--   * reps_alvo NULL = sem alvo: o app usa as reps da última sessão, limitadas a [reps_min, reps_max].
--   * carga_alvo já existe; os dois são ajustados pelo assistente com `fit target`.
alter table public.template_exercises add column if not exists reps_alvo integer;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'template_exercises_reps_alvo_check') then
    alter table public.template_exercises add constraint template_exercises_reps_alvo_check check (reps_alvo > 0);
  end if;
end $$;
