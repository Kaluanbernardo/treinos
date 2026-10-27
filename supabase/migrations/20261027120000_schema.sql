-- F0 · Schema base do app de fitness (single user, sem user_id).
-- Colunas comuns: id uuid, created_at, updated_at (trigger), source ('app' | 'bot').
-- Datas "do dia" são sempre no fuso America/Sao_Paulo.

-- ---------------------------------------------------------------- tipos
do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'modality' and n.nspname = 'public') then
    create type public.modality as enum ('musculacao', 'muay_thai', 'jiu_jitsu', 'cross', 'funcional');
  end if;
end $$;

-- ---------------------------------------------------------------- helpers
create or replace function public.today_sp()
returns date
language sql stable
set search_path = ''
as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- tabelas
create table if not exists public.goals (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  source                text not null default 'app' check (source in ('app', 'bot')),
  singleton             boolean not null default true unique check (singleton),
  deficit_kcal          integer not null default 300,
  kcal_target           integer,                      -- TDEE − déficit; preenchido pelo bot após o 1º peso
  protein_g_per_kg_min  numeric(3,1) not null default 2.0,
  protein_g_per_kg_max  numeric(3,1) not null default 2.2,
  creatine_g_min        numeric(3,1) not null default 3,
  creatine_g_max        numeric(3,1) not null default 5,
  water_ml_per_kg_min   integer not null default 35,
  water_ml_per_kg_max   integer not null default 40,
  max_loss_pct_week     numeric(3,2) not null default 0.5,
  note                  text
);

create table if not exists public.body_metrics (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  source       text not null default 'app' check (source in ('app', 'bot')),
  date         date not null unique default public.today_sp(),
  peso_kg      numeric(5,2) check (peso_kg > 0),
  cintura_cm   numeric(5,1) check (cintura_cm > 0),
  abdomen_cm   numeric(5,1) check (abdomen_cm > 0),
  quadril_cm   numeric(5,1) check (quadril_cm > 0),
  peito_cm     numeric(5,1) check (peito_cm > 0),
  braco_cm     numeric(5,1) check (braco_cm > 0),
  coxa_cm      numeric(5,1) check (coxa_cm > 0),
  gordura_pct  numeric(4,1) check (gordura_pct between 1 and 70),
  nota         text
);

create table if not exists public.progress_photos (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  source      text not null default 'app' check (source in ('app', 'bot')),
  date        date not null default public.today_sp(),
  pose        text not null check (pose in ('frente', 'lado', 'costas')),
  path        text not null,
  thumb_path  text,
  nota        text
);
create index if not exists progress_photos_date_idx on public.progress_photos (date);

create table if not exists public.exercises (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  source        text not null default 'app' check (source in ('app', 'bot')),
  slug          text not null unique,
  name          text not null,                 -- pt-BR
  muscle_group  text not null,
  main_lift     boolean not null default false, -- entra na seta de força
  video_url     text,
  tips          text
);

create table if not exists public.workout_templates (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  source       text not null default 'app' check (source in ('app', 'bot')),
  slug         text not null unique,
  name         text not null,
  modality     public.modality not null default 'musculacao',
  warmup       text,
  note         text,
  est_minutes  integer
);

create table if not exists public.template_exercises (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  source       text not null default 'app' check (source in ('app', 'bot')),
  template_id  uuid not null references public.workout_templates (id) on delete cascade,
  exercise_id  uuid not null references public.exercises (id) on delete restrict,
  position     integer not null,                -- ordem na ficha
  sets         integer not null check (sets > 0),
  reps_min     integer,                         -- null = "máx"
  reps_max     integer,
  reps_unit    text not null default 'reps' check (reps_unit in ('reps', 's', 'm', 'max')),
  per_side     boolean not null default false,
  rir          text,                            -- ex.: '2', '1–2', '0–1 na última'
  rest_s_min   integer,
  rest_s_max   integer,
  carga_alvo   numeric(6,2),                    -- kg; o bot ajusta na progressão
  warmup       text,                            -- séries de aproximação específicas
  note         text,
  unique (template_id, position)
);
create index if not exists template_exercises_exercise_idx on public.template_exercises (exercise_id);

create table if not exists public.schedule_slots (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  source        text not null default 'app' check (source in ('app', 'bot')),
  weekday       smallint not null check (weekday between 1 and 7),  -- ISO: 1 = seg … 7 = dom
  start_time    time not null,
  duration_min  integer not null default 60,
  modality      public.modality not null,
  template_id   uuid references public.workout_templates (id) on delete set null,
  title         text not null,
  note          text,
  active        boolean not null default true,
  unique (weekday, start_time)
);

-- Exceções da grade:
--   skip    → a ocorrência do slot nessa data não acontece
--   replace → a ocorrência do slot nessa data vira outra coisa (modalidade/ficha/horário)
--   add     → atividade extra nessa data (remarcação = skip/replace no dia original + add no novo)
create table if not exists public.schedule_overrides (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  source        text not null default 'app' check (source in ('app', 'bot')),
  date          date not null,
  action        text not null check (action in ('skip', 'replace', 'add')),
  slot_id       uuid references public.schedule_slots (id) on delete cascade,
  start_time    time,
  duration_min  integer,
  modality      public.modality,
  template_id   uuid references public.workout_templates (id) on delete set null,
  title         text,
  motivo        text,
  check (action = 'add' or slot_id is not null),
  check (action <> 'add' or (start_time is not null and modality is not null))
);
create index if not exists schedule_overrides_date_idx on public.schedule_overrides (date);

create table if not exists public.sessions (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  source       text not null default 'app' check (source in ('app', 'bot')),
  date         date not null default public.today_sp(),
  modality     public.modality not null,
  template_id  uuid references public.workout_templates (id) on delete set null,
  slot_id      uuid references public.schedule_slots (id) on delete set null,
  override_id  uuid references public.schedule_overrides (id) on delete set null,
  status       text not null default 'feito' check (status in ('em_andamento', 'feito', 'parcial', 'faltou')),
  started_at   timestamptz,
  ended_at     timestamptz,
  note         text
);
create index if not exists sessions_date_idx on public.sessions (date);

create table if not exists public.set_logs (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  source       text not null default 'app' check (source in ('app', 'bot')),
  session_id   uuid not null references public.sessions (id) on delete cascade,
  exercise_id  uuid not null references public.exercises (id) on delete restrict,
  set_number   integer not null check (set_number > 0),
  kg           numeric(6,2) check (kg >= 0),
  reps         integer check (reps >= 0),
  rir          numeric(3,1),
  warmup       boolean not null default false,
  logged_at    timestamptz not null default now(),
  note         text
);
create index if not exists set_logs_session_idx on public.set_logs (session_id);
create index if not exists set_logs_exercise_idx on public.set_logs (exercise_id, logged_at);

create table if not exists public.foods (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  source      text not null default 'app' check (source in ('app', 'bot')),
  code        text unique,               -- 'taco:<n>' ou 'custom:<slug>'
  name        text not null,
  category    text,
  is_custom   boolean not null default false,
  kcal        numeric(7,2),              -- por 100 g
  protein_g   numeric(6,2),
  carb_g      numeric(6,2),
  fat_g       numeric(6,2),
  fiber_g     numeric(6,2)
);

create table if not exists public.food_portions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  source      text not null default 'app' check (source in ('app', 'bot')),
  food_id     uuid not null references public.foods (id) on delete cascade,
  label       text not null,             -- '1 colher de sopa'
  grams       numeric(7,2) not null check (grams > 0),
  unique (food_id, label)
);

create table if not exists public.food_logs (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  source         text not null default 'app' check (source in ('app', 'bot')),
  date           date not null default public.today_sp(),
  meal           text,                    -- café, almoço, lanche, jantar, pré-treino…
  food_id        uuid references public.foods (id) on delete set null,
  description    text not null,
  grams          numeric(7,2),
  portion_label  text,
  portion_qty    numeric(6,2),
  -- snapshot dos macros no momento do registro
  kcal           numeric(7,2) not null default 0,
  protein_g      numeric(6,2) not null default 0,
  carb_g         numeric(6,2) not null default 0,
  fat_g          numeric(6,2) not null default 0,
  estimated      boolean not null default false,
  logged_at      timestamptz not null default now(),
  note           text
);
create index if not exists food_logs_date_idx on public.food_logs (date);

create table if not exists public.daily_checks (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  source      text not null default 'app' check (source in ('app', 'bot')),
  date        date not null unique default public.today_sp(),
  creatine    boolean not null default false,
  creatine_g  numeric(3,1),
  water_ml    integer,
  note        text
);

create table if not exists public.bot_notes (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  source      text not null default 'bot' check (source in ('app', 'bot')),
  kind        text not null default 'nota' check (kind in ('nota', 'decisao', 'carga', 'remarcacao', 'alerta', 'resumo')),
  text        text not null,
  ref_table   text,
  ref_id      uuid
);
create index if not exists bot_notes_created_idx on public.bot_notes (created_at desc);

-- ---------------------------------------------------------------- triggers updated_at
do $$
declare t text;
begin
  foreach t in array array[
    'goals', 'body_metrics', 'progress_photos', 'exercises', 'workout_templates',
    'template_exercises', 'schedule_slots', 'schedule_overrides', 'sessions', 'set_logs',
    'foods', 'food_portions', 'food_logs', 'daily_checks', 'bot_notes'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;
