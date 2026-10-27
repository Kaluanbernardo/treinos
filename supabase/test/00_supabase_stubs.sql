-- TEST-ONLY: emula o mínimo do Supabase num Postgres 17 local.
-- NÃO faz parte das migrations reais (o Supabase hospedado já tem tudo isso).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  email text
);
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- Supabase: public tem grants padrão para anon/authenticated; auth não é acessível a eles.
revoke all on schema auth from public;
grant usage on schema auth to anon, authenticated, service_role;  -- como no Supabase (para auth.uid())
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
-- Supabase concede privilégios padrão em public para anon/authenticated; emulamos isso
-- para provar que a migration revoga anon corretamente.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
-- PG15+: public não tem CREATE para PUBLIC por padrão.
