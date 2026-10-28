-- Fotos de refeição: o feed da Nutrição mostra cada refeição com a foto que o Kaluan mandou no chat.
--   * meal_photos: 1+ fotos por (data, refeição); `meal` casa com food_logs.meal (texto livre: cafe, almoço…).
--   * bucket privado `meals`: só o dono lê (signed URLs no app); o upload é feito pelo box com a chave de
--     serviço (scripts/fit meal-photo, sem EXIF, 1600 px + miniatura 400 px). Sem acesso de anon.
--     Ignorado onde não há Storage (teste local).

create table if not exists public.meal_photos (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  source      text not null default 'app' check (source in ('app', 'bot')),
  date        date not null default public.today_sp(),
  meal        text not null check (length(trim(meal)) > 0),
  path        text not null,
  thumb_path  text,
  note        text
);
create index if not exists meal_photos_date_idx on public.meal_photos (date);

drop trigger if exists set_updated_at on public.meal_photos;
create trigger set_updated_at before update on public.meal_photos
  for each row execute function public.set_updated_at();

alter table public.meal_photos enable row level security;
revoke all on public.meal_photos from public, anon, authenticated, bot;
grant select, insert, update, delete on public.meal_photos to authenticated, bot;

drop policy if exists owner_all on public.meal_photos;
create policy owner_all on public.meal_photos for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
drop policy if exists bot_all on public.meal_photos;
create policy bot_all on public.meal_photos for all to bot using (true) with check (true);

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage ausente (teste local): bucket meals não criado';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('meals', 'meals', false, 5 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
                                 allowed_mime_types = excluded.allowed_mime_types;

  execute 'drop policy if exists meals_owner_read on storage.objects';
  execute $p$create policy meals_owner_read on storage.objects for select to authenticated
             using (bucket_id = 'meals' and (select public.is_owner()))$p$;
end $$;
