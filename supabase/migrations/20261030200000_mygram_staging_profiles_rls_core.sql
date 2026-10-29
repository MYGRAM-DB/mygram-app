-- Additive MYGRAM staging bootstrap. Existing auth trigger handle_new_user() inserts
-- into public.profiles(id, full_name, username); preserve that contract.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  username text,
  bio text not null default '',
  avatar_url text,
  cover_url text,
  interests text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username is null or username ~ '^[a-zA-Z0-9_]{3,30}$')
);
create unique index if not exists profiles_username_lower_uidx
  on public.profiles (lower(username)) where username is not null;

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language_code text not null default 'ar',
  current_country_code text,
  nationality_code text,
  region text,
  city_name text,
  share_location boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '',
  media_url text,
  media_type text check (media_type is null or media_type in ('image','video','audio','file')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_content_or_media check (length(btrim(content)) > 0 or media_url is not null)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (length(btrim(content)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('like','love','haha','care','wow','sad','angry','fire')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_reactions_one_per_user unique (post_id, user_id)
);

-- Default-deny API roles, then grant only operations required by the current UI.
revoke all on table public.profiles, public.user_preferences, public.posts,
  public.post_comments, public.post_reactions from anon, authenticated;
grant select on table public.profiles to authenticated;
grant insert (id, full_name, username, bio, avatar_url, cover_url, interests),
      update (full_name, username, bio, avatar_url, cover_url, interests, updated_at)
  on table public.profiles to authenticated;
grant select, insert, update, delete on table public.user_preferences to authenticated;
grant select, insert, update, delete on table public.posts to authenticated;
grant select, insert, update, delete on table public.post_comments to authenticated;
grant select, insert, update, delete on table public.post_reactions to authenticated;

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.posts enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_reactions enable row level security;

drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated on public.profiles
  for select to authenticated using (true);
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists user_preferences_select_self on public.user_preferences;
create policy user_preferences_select_self on public.user_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists user_preferences_insert_self on public.user_preferences;
create policy user_preferences_insert_self on public.user_preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists user_preferences_update_self on public.user_preferences;
create policy user_preferences_update_self on public.user_preferences
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists user_preferences_delete_self on public.user_preferences;
create policy user_preferences_delete_self on public.user_preferences
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists posts_select_authenticated on public.posts;
create policy posts_select_authenticated on public.posts
  for select to authenticated using (true);
drop policy if exists posts_insert_self on public.posts;
create policy posts_insert_self on public.posts
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists posts_update_self on public.posts;
create policy posts_update_self on public.posts
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists posts_delete_self on public.posts;
create policy posts_delete_self on public.posts
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists post_comments_select_authenticated on public.post_comments;
create policy post_comments_select_authenticated on public.post_comments
  for select to authenticated using (true);
drop policy if exists post_comments_insert_self on public.post_comments;
create policy post_comments_insert_self on public.post_comments
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists post_comments_update_self on public.post_comments;
create policy post_comments_update_self on public.post_comments
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists post_comments_delete_self on public.post_comments;
create policy post_comments_delete_self on public.post_comments
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists post_reactions_select_authenticated on public.post_reactions;
create policy post_reactions_select_authenticated on public.post_reactions
  for select to authenticated using (true);
drop policy if exists post_reactions_insert_self on public.post_reactions;
create policy post_reactions_insert_self on public.post_reactions
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists post_reactions_update_self on public.post_reactions;
create policy post_reactions_update_self on public.post_reactions
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists post_reactions_delete_self on public.post_reactions;
create policy post_reactions_delete_self on public.post_reactions
  for delete to authenticated using ((select auth.uid()) = user_id);

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_user_id_created_at_idx on public.posts (user_id, created_at desc);
create index if not exists post_comments_post_created_idx on public.post_comments (post_id, created_at);
create index if not exists post_reactions_post_id_idx on public.post_reactions (post_id);
