-- Pular exercício: estado por exercício dentro de uma sessão (hoje só `skipped`).
--   * tabela nova, aditiva: sessões e séries existentes (inclusive um treino em andamento) não mudam;
--     sem linha = exercício não pulado.
--   * 1 linha por (sessão, exercício); o app faz upsert e "desfazer" volta skipped = false.
--   * v_sessions ganha n_skipped no fim (create or replace preserva grants e colunas anteriores).

create table if not exists public.session_exercise_status (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  source       text not null default 'app' check (source in ('app', 'bot')),
  session_id   uuid not null references public.sessions (id) on delete cascade,
  exercise_id  uuid not null references public.exercises (id) on delete restrict,
  skipped      boolean not null default false,
  unique (session_id, exercise_id)
);

drop trigger if exists set_updated_at on public.session_exercise_status;
create trigger set_updated_at before update on public.session_exercise_status
  for each row execute function public.set_updated_at();

alter table public.session_exercise_status enable row level security;
revoke all on public.session_exercise_status from public, anon, authenticated, bot;
grant select, insert, update on public.session_exercise_status to authenticated, bot;

drop policy if exists owner_all on public.session_exercise_status;
create policy owner_all on public.session_exercise_status for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
drop policy if exists bot_all on public.session_exercise_status;
create policy bot_all on public.session_exercise_status for all to bot using (true) with check (true);

create or replace view public.v_sessions with (security_invoker = true) as
  select s.id, s.date, s.modality, public.modality_label(s.modality) as modality_label,
         s.template_id, wt.slug as template_slug, coalesce(wt.name, public.modality_label(s.modality)) as title,
         s.status, s.started_at, s.ended_at, s.note, s.source,
         case when s.started_at is not null and s.ended_at is not null
              then round(extract(epoch from s.ended_at - s.started_at) / 60)::int end as duration_min,
         coalesce(a.n_sets, 0) as n_sets,
         coalesce(a.n_exercises, 0) as n_exercises,
         coalesce(a.volume_kg, 0) as volume_kg,
         coalesce(p.n_prs, 0) as n_prs,
         coalesce(k.n_skipped, 0) as n_skipped
  from public.sessions s
  left join public.workout_templates wt on wt.id = s.template_id
  left join lateral (
    select count(*)::int as n_sets, count(distinct sl.exercise_id)::int as n_exercises,
           sum(coalesce(sl.kg, 0) * coalesce(sl.reps, 0)) as volume_kg
    from public.set_logs sl where sl.session_id = s.id and not sl.warmup
  ) a on true
  left join lateral (
    select count(distinct p.exercise_id)::int as n_prs from public.v_prs p where p.session_id = s.id and p.is_pr
  ) p on true
  left join lateral (
    select count(*)::int as n_skipped from public.session_exercise_status x where x.session_id = s.id and x.skipped
  ) k on true;

revoke all on public.v_sessions from public, anon;
grant select on public.v_sessions to authenticated, bot;
