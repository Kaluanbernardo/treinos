-- F0 · Segurança: dono único (is_owner), RLS, role `bot`, grants. anon não acessa nada.

-- ---------------------------------------------------------------- dono
-- 1 linha. owner_uuid NULL = ninguém tem acesso até scripts/set_owner.sh rodar.
create table if not exists public.app_config (
  singleton   boolean primary key default true check (singleton),
  owner_uuid  uuid,
  updated_at  timestamptz not null default now()
);
insert into public.app_config (singleton, owner_uuid) values (true, null)
on conflict (singleton) do nothing;

alter table public.app_config enable row level security;
-- sem policies: só o owner da tabela (postgres) lê/escreve; os demais passam por is_owner().
revoke all on public.app_config from public, anon, authenticated;

create or replace function public.is_owner()
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select c.owner_uuid is not null and c.owner_uuid = auth.uid() from public.app_config c limit 1),
    false)
$$;

-- ---------------------------------------------------------------- role bot
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'bot') then
    create role bot nologin nobypassrls;   -- senha/LOGIN: scripts/create_bot_role_password.sh
  end if;
end $$;
alter role bot nobypassrls nocreatedb nocreaterole noinherit;

revoke create on schema public from public;
revoke all on schema public from bot;
grant usage on schema public to bot;
revoke all on app_config from bot;
-- auth/storage: nada para o bot (no-op se nunca houve grant)
revoke all on schema auth from bot;
revoke all on all tables in schema auth from bot;

-- ---------------------------------------------------------------- RLS + grants por tabela
do $$
declare
  t text;
  app_tables text[] := array[
    'goals', 'body_metrics', 'progress_photos', 'exercises', 'workout_templates',
    'template_exercises', 'schedule_slots', 'schedule_overrides', 'sessions', 'set_logs',
    'foods', 'food_portions', 'food_logs', 'daily_checks', 'bot_notes'
  ];
  deletable text[] := array['schedule_overrides', 'food_logs', 'set_logs', 'body_metrics'];
begin
  foreach t in array app_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated, bot', t);
    execute format('grant select, insert, update on public.%I to authenticated, bot', t);
    if t = any (deletable) then
      execute format('grant delete on public.%I to authenticated, bot', t);
    end if;

    execute format('drop policy if exists owner_all on public.%I', t);
    execute format('create policy owner_all on public.%I for all to authenticated
                    using ((select public.is_owner())) with check ((select public.is_owner()))', t);
    execute format('drop policy if exists bot_all on public.%I', t);
    execute format('create policy bot_all on public.%I for all to bot using (true) with check (true)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- views
do $$
declare v text;
begin
  for v in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'v' and c.relname like 'v\_%'
  loop
    execute format('revoke all on public.%I from public, anon, authenticated, bot', v);
    execute format('grant select on public.%I to authenticated, bot', v);
  end loop;
end $$;

-- ---------------------------------------------------------------- funções
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.is_owner(), public.today_sp(), public.modality_label(public.modality),
  public.trend_arrow(numeric, numeric), public.week_start(date),
  public.plan_between(date, date), public.plan_with_sessions(date, date),
  public.period_summary(text)
to authenticated, bot;

-- enum precisa de USAGE para cast/insert (PG concede a PUBLIC por padrão; anon não usa nada mesmo)
grant usage on type public.modality to authenticated, bot;

-- ---------------------------------------------------------------- default privileges
-- O Supabase concede tudo em public para anon por padrão; objetos futuros criados por este role
-- (postgres) não devem herdar isso.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon, public;
