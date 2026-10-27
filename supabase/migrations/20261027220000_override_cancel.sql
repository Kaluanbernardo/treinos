-- Override 'cancel': cancela uma ocorrência da grade sem deixá-la visível (ao contrário de 'skip', que aparece como 'pulado').
-- plan_between descarta a ocorrência inteira (nenhuma linha). Assinatura inalterada: grants e views dependentes preservados.

alter table public.schedule_overrides drop constraint schedule_overrides_action_check;
alter table public.schedule_overrides add constraint schedule_overrides_action_check
  check (action in ('skip', 'replace', 'add', 'cancel'));

create or replace function public.plan_between(p_from date, p_to date)
returns table (
  date          date,
  start_time    time,
  duration_min  integer,
  modality      public.modality,
  template_id   uuid,
  title         text,
  plan_kind     text,
  slot_id       uuid,
  override_id   uuid,
  motivo        text,
  active        boolean
)
language sql stable
security invoker
set search_path = ''
as $$
  with days as (
    select g::date as d
    from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') g
  ),
  base as (
    select dd.d, s.id as sid, s.start_time as st, s.duration_min as dur, s.modality as m,
           s.template_id as tid, s.title as ttl
    from days dd
    join public.schedule_slots s on s.active and s.weekday = extract(isodow from dd.d)
  )
  select b.d,
         case when o.action = 'replace' then coalesce(o.start_time, b.st) else b.st end,
         case when o.action = 'replace' then coalesce(o.duration_min, b.dur) else b.dur end,
         case when o.action = 'replace' then coalesce(o.modality, b.m) else b.m end,
         case
           when o.action is distinct from 'replace' then b.tid
           when o.template_id is not null then o.template_id
           when o.modality is null or o.modality = b.m then b.tid
           else null
         end,
         case when o.action = 'replace' then coalesce(o.title, b.ttl) else b.ttl end,
         case o.action when 'replace' then 'substituido' when 'skip' then 'pulado' else 'base' end,
         b.sid,
         o.id,
         o.motivo,
         o.action is distinct from 'skip'
  from base b
  left join lateral (
    select so.* from public.schedule_overrides so
    where so.slot_id = b.sid and so.date = b.d and so.action in ('skip', 'replace', 'cancel')
    order by so.created_at desc
    limit 1
  ) o on true
  where o.action is distinct from 'cancel'
  union all
  select so.date, so.start_time, coalesce(so.duration_min, 60), so.modality, so.template_id,
         coalesce(so.title, wt.name, public.modality_label(so.modality)),
         'adicionado', null, so.id, so.motivo, true
  from public.schedule_overrides so
  left join public.workout_templates wt on wt.id = so.template_id
  where so.action = 'add' and so.date between p_from and p_to
$$;
