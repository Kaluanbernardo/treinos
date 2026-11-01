-- Home: o status do treino do dia segue a sessão da data, não só o horário.
--
-- plan_with_sessions casava a sessão pelo override/slot ou pela mesma ficha
-- (template_id idêntico, inclusive os dois nulos). Uma sessão de musculação
-- gravada no app com override_id/slot_id nulos não atualizava um item
-- "adicionado" quando a ficha do plano era outra ou estava vazia: a home
-- (v_today / v_week) continuava pendente com a sessão já feita.
--
-- A grade (plan_between, overrides) não muda. Só a leitura do status.

create or replace function public.plan_with_sessions(p_from date, p_to date)
returns table (
  date            date,
  start_time      time,
  duration_min    integer,
  starts_at       timestamptz,
  ends_at         timestamptz,
  modality        public.modality,
  modality_label  text,
  title           text,
  plan_kind       text,
  active          boolean,
  motivo          text,
  slot_id         uuid,
  override_id     uuid,
  template_id     uuid,
  template_slug   text,
  template_name   text,
  template_warmup text,
  template_note   text,
  est_minutes     integer,
  exercise_count  integer,
  session_id      uuid,
  session_status  text
)
language sql stable
security invoker
set search_path = ''
as $$
  with plan as (
    select * from public.plan_between(p_from, p_to)
  ),
  cand as (
    select p.date, p.start_time, p.slot_id, p.override_id,
           s.id as session_id, s.status as session_status,
           case
             when p.override_id is not null and s.override_id = p.override_id then 0
             when p.slot_id is not null and s.slot_id = p.slot_id and s.override_id is null then 1
             when p.template_id is not null and s.template_id = p.template_id then 2
             else 3
           end as match_rank,
           case s.status
             when 'feito' then 0
             when 'parcial' then 1
             when 'em_andamento' then 2
             when 'faltou' then 3
             else 4
           end as status_rank,
           abs(extract(epoch from coalesce(s.started_at, s.created_at)
               - ((p.date + p.start_time) at time zone 'America/Sao_Paulo'))) as dist
    from plan p
    join public.sessions s on s.date = p.date
    where p.active
      and (
        (p.override_id is not null and s.override_id = p.override_id)
        or (p.slot_id is not null and s.slot_id = p.slot_id and s.override_id is null)
        or (p.template_id is not null and s.template_id = p.template_id)
        or (
          -- mesma modalidade no dia, sem roubar sessão que é de outro horário/ficha
          s.modality = p.modality
          and not exists (
            select 1
            from plan o
            where o.active
              and o.date = p.date
              and (o.slot_id is distinct from p.slot_id or o.override_id is distinct from p.override_id)
              and (
                (o.override_id is not null and s.override_id = o.override_id)
                or (o.slot_id is not null and s.slot_id = o.slot_id and s.override_id is null)
                or (o.template_id is not null and s.template_id = o.template_id
                    and s.template_id is distinct from p.template_id)
              )
          )
        )
      )
  ),
  claimed as (
    select c.*,
           row_number() over (
             partition by c.session_id
             order by c.match_rank, c.dist, c.start_time
           ) as claim
    from cand c
  ),
  best as (
    select distinct on (c.date, c.start_time, c.slot_id, c.override_id)
           c.date, c.start_time, c.slot_id, c.override_id, c.session_id, c.session_status
    from claimed c
    where c.claim = 1
    order by c.date, c.start_time, c.slot_id, c.override_id, c.status_rank, c.match_rank, c.dist
  )
  select p.date, p.start_time, p.duration_min,
         (p.date + p.start_time) at time zone 'America/Sao_Paulo',
         (p.date + p.start_time + make_interval(mins => p.duration_min)) at time zone 'America/Sao_Paulo',
         p.modality, public.modality_label(p.modality), p.title, p.plan_kind, p.active, p.motivo,
         p.slot_id, p.override_id, p.template_id,
         wt.slug, wt.name, wt.warmup, wt.note, wt.est_minutes,
         (select count(*)::int from public.template_exercises te where te.template_id = p.template_id),
         b.session_id, b.session_status
  from plan p
  left join public.workout_templates wt on wt.id = p.template_id
  left join best b
    on b.date = p.date
   and b.start_time is not distinct from p.start_time
   and b.slot_id is not distinct from p.slot_id
   and b.override_id is not distinct from p.override_id
$$;

-- Sessões já salvas sem horário (ex.: finalizadas no app) passam a apontar para o
-- único item ativo daquela modalidade no dia, se ninguém mais o ocupa.
-- Dia com dois horários da mesma modalidade fica sem chute: a view acima já mostra o status.
with open as (
  select s.id, s.date, s.modality
  from public.sessions s
  where s.slot_id is null and s.override_id is null
),
one_mod as (
  select o.id as session_id, p.slot_id, p.override_id
  from open o
  join lateral (
    select pb.slot_id, pb.override_id
    from public.plan_between(o.date, o.date) pb
    where pb.active and pb.modality = o.modality
  ) p on true
  where (
    select count(*) from public.plan_between(o.date, o.date) p2
    where p2.active and p2.modality = o.modality
  ) = 1
    and not exists (
      select 1 from public.sessions other
      where other.id <> o.id
        and (
          (p.override_id is not null and other.override_id = p.override_id)
          or (p.slot_id is not null and other.slot_id = p.slot_id and other.override_id is null)
        )
    )
)
update public.sessions s
set slot_id = m.slot_id,
    override_id = m.override_id
from one_mod m
where s.id = m.session_id
  and s.slot_id is null
  and s.override_id is null;
