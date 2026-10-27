-- F1 · Treino em andamento + evolução básica.
--   * sessions ganha DELETE (desfazer Feito/Faltei e descartar treino vazio no app; o bot também corrige)
--   * v_sessions: histórico de sessões com séries, volume e PRs
--   * prev_sets(sessão) / prev_bests(sessão): o que o app usa para pré-preencher séries e detectar PR ao vivo,
--     sempre IGNORANDO a sessão em andamento (recarregar a tela não muda a referência)

grant delete on public.sessions to authenticated, bot;

drop view if exists public.v_sessions;
create view public.v_sessions with (security_invoker = true) as
  select s.id, s.date, s.modality, public.modality_label(s.modality) as modality_label,
         s.template_id, wt.slug as template_slug, coalesce(wt.name, public.modality_label(s.modality)) as title,
         s.status, s.started_at, s.ended_at, s.note, s.source,
         case when s.started_at is not null and s.ended_at is not null
              then round(extract(epoch from s.ended_at - s.started_at) / 60)::int end as duration_min,
         coalesce(a.n_sets, 0) as n_sets,
         coalesce(a.n_exercises, 0) as n_exercises,
         coalesce(a.volume_kg, 0) as volume_kg,
         coalesce(p.n_prs, 0) as n_prs
  from public.sessions s
  left join public.workout_templates wt on wt.id = s.template_id
  left join lateral (
    select count(*)::int as n_sets, count(distinct sl.exercise_id)::int as n_exercises,
           sum(coalesce(sl.kg, 0) * coalesce(sl.reps, 0)) as volume_kg
    from public.set_logs sl where sl.session_id = s.id and not sl.warmup
  ) a on true
  left join lateral (
    select count(distinct p.exercise_id)::int as n_prs from public.v_prs p where p.session_id = s.id and p.is_pr
  ) p on true;

-- Séries da sessão anterior de cada exercício (sem aquecimento), excluindo p_session.
create or replace function public.prev_sets(p_session uuid)
returns table (exercise_id uuid, session_id uuid, date date, set_number integer, kg numeric, reps integer)
language sql stable
security invoker
set search_path = ''
as $$
  with last as (
    select distinct on (sl.exercise_id) sl.exercise_id, sl.session_id, s.date
    from public.set_logs sl
    join public.sessions s on s.id = sl.session_id
    where not sl.warmup and sl.session_id is distinct from p_session
    order by sl.exercise_id, s.date desc, sl.logged_at desc
  )
  select l.exercise_id, l.session_id, l.date, sl.set_number, sl.kg, sl.reps
  from last l
  join public.set_logs sl on sl.session_id = l.session_id and sl.exercise_id = l.exercise_id and not sl.warmup
  order by l.exercise_id, sl.set_number
$$;

-- Recordes por exercício ANTES de p_session (mesma regra de v_prs: sem aquecimento, kg > 0; 1RM só 1–12 reps).
create or replace function public.prev_bests(p_session uuid)
returns table (exercise_id uuid, best_kg numeric, best_e1rm numeric)
language sql stable
security invoker
set search_path = ''
as $$
  select sl.exercise_id,
         max(sl.kg),
         max(case when sl.reps between 1 and 12 then round(sl.kg * (1 + sl.reps / 30.0), 2) end)
  from public.set_logs sl
  where not sl.warmup and sl.reps >= 1 and sl.kg > 0 and sl.session_id is distinct from p_session
  group by sl.exercise_id
$$;

revoke all on public.v_sessions from public, anon;
grant select on public.v_sessions to authenticated, bot;
revoke execute on function public.prev_sets(uuid), public.prev_bests(uuid) from public, anon;
grant execute on function public.prev_sets(uuid), public.prev_bests(uuid) to authenticated, bot;
