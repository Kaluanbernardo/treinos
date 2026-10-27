-- F4 · Evolução completa + fotos de progresso.
--   * v_muscle_volume_weekly: volume semanal (Σ kg × reps, sem aquecimento) por grupo muscular
--   * bucket privado `progress` (fotos de progresso): só o dono lê (signed URLs no app); o upload é feito
--     pelo box com a chave de serviço (scripts/fit photo). Sem acesso de anon. Ignorado onde não há Storage.

drop view if exists public.v_muscle_volume_weekly;
create view public.v_muscle_volume_weekly with (security_invoker = true) as
  select public.week_start(s.date) as week_start,
         e.muscle_group,
         count(*)::int as n_sets,
         sum(coalesce(sl.kg, 0) * sl.reps) as volume_kg
  from public.set_logs sl
  join public.sessions s on s.id = sl.session_id
  join public.exercises e on e.id = sl.exercise_id
  where not sl.warmup and sl.reps > 0
  group by 1, 2;

revoke all on public.v_muscle_volume_weekly from public, anon;
grant select on public.v_muscle_volume_weekly to authenticated, bot;

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage ausente (teste local): bucket progress não criado';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('progress', 'progress', false, 5 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
                                 allowed_mime_types = excluded.allowed_mime_types;

  execute 'drop policy if exists progress_owner_read on storage.objects';
  execute $p$create policy progress_owner_read on storage.objects for select to authenticated
             using (bucket_id = 'progress' and (select public.is_owner()))$p$;
end $$;
