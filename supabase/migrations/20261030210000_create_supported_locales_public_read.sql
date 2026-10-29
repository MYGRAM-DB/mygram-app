create table if not exists public.supported_locales (
  code text primary key,
  native_name text not null,
  english_name text not null,
  is_rtl boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint supported_locales_code_format check (code ~ '^[a-z]{2,3}(-[A-Z]{2})?$')
);

alter table public.supported_locales enable row level security;

drop policy if exists "Public can read active supported locales" on public.supported_locales;
create policy "Public can read active supported locales"
  on public.supported_locales
  for select
  to anon, authenticated
  using (is_active = true);

revoke all on table public.supported_locales from public;
grant select on table public.supported_locales to anon, authenticated;

insert into public.supported_locales (code, native_name, english_name, is_rtl, sort_order)
values
  ('ar','العربية','Arabic',true,1),
  ('en','English','English',false,2),
  ('fr','Français','French',false,3),
  ('es','Español','Spanish',false,4),
  ('pt','Português','Portuguese',false,5),
  ('de','Deutsch','German',false,6),
  ('it','Italiano','Italian',false,7),
  ('tr','Türkçe','Turkish',false,8),
  ('zh','中文','Chinese',false,9),
  ('ja','日本語','Japanese',false,10),
  ('ru','Русский','Russian',false,11),
  ('hi','हिन्दी','Hindi',false,12),
  ('id','Bahasa Indonesia','Indonesian',false,13),
  ('nl','Nederlands','Dutch',false,14)
on conflict (code) do update set
  native_name = excluded.native_name,
  english_name = excluded.english_name,
  is_rtl = excluded.is_rtl,
  is_active = true,
  sort_order = excluded.sort_order;