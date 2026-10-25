-- Add community reactions and comments to short-form reels.
create table if not exists public.reel_reactions (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('like','love','haha','care','wow','sad','angry','fire')),
  created_at timestamptz not null default now(),
  constraint reel_reactions_reel_user_unique unique (reel_id,user_id)
);
create index if not exists reel_reactions_reel_idx on public.reel_reactions(reel_id);
alter table public.reel_reactions enable row level security;
drop policy if exists "Authenticated users can view reel reactions" on public.reel_reactions;
create policy "Authenticated users can view reel reactions" on public.reel_reactions for select to authenticated using (true);
drop policy if exists "Users can add own reel reactions" on public.reel_reactions;
create policy "Users can add own reel reactions" on public.reel_reactions for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Users can update own reel reactions" on public.reel_reactions;
create policy "Users can update own reel reactions" on public.reel_reactions for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "Users can remove own reel reactions" on public.reel_reactions;
create policy "Users can remove own reel reactions" on public.reel_reactions for delete to authenticated using (user_id = (select auth.uid()));

create table if not exists public.reel_comments (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists reel_comments_reel_created_idx on public.reel_comments(reel_id,created_at);
alter table public.reel_comments enable row level security;
drop policy if exists "Authenticated users can view reel comments" on public.reel_comments;
create policy "Authenticated users can view reel comments" on public.reel_comments for select to authenticated using (true);
drop policy if exists "Users can add own reel comments" on public.reel_comments;
create policy "Users can add own reel comments" on public.reel_comments for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Users can delete own reel comments" on public.reel_comments;
create policy "Users can delete own reel comments" on public.reel_comments for delete to authenticated using (user_id = (select auth.uid()));
