-- Community groups with member-only publishing and owner controls.
create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 3 and 80),
  description text not null default '' check (char_length(description) <= 500),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists communities_created_at_idx on public.communities(created_at desc);
create table if not exists public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  joined_at timestamptz not null default now(),
  primary key(community_id,user_id)
);
create index if not exists community_members_user_idx on public.community_members(user_id,community_id);
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists community_posts_feed_idx on public.community_posts(community_id,created_at desc);
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.community_posts enable row level security;
drop policy if exists "Authenticated members can discover communities" on public.communities;
create policy "Authenticated members can discover communities" on public.communities for select to authenticated using (true);
drop policy if exists "Members can create communities" on public.communities;
create policy "Members can create communities" on public.communities for insert to authenticated with check (created_by=(select auth.uid()));
drop policy if exists "Community owners can update communities" on public.communities;
create policy "Community owners can update communities" on public.communities for update to authenticated using (created_by=(select auth.uid())) with check (created_by=(select auth.uid()));
drop policy if exists "Community owners can delete communities" on public.communities;
create policy "Community owners can delete communities" on public.communities for delete to authenticated using (created_by=(select auth.uid()));
drop policy if exists "Authenticated members can view community membership" on public.community_members;
create policy "Authenticated members can view community membership" on public.community_members for select to authenticated using (true);
drop policy if exists "Users can join communities" on public.community_members;
create policy "Users can join communities" on public.community_members for insert to authenticated with check (user_id=(select auth.uid()) and role='member' or user_id=(select auth.uid()) and role='owner' and exists(select 1 from public.communities c where c.id=community_id and c.created_by=(select auth.uid())));
drop policy if exists "Members can leave communities" on public.community_members;
create policy "Members can leave communities" on public.community_members for delete to authenticated using (user_id=(select auth.uid()) and role<>'owner');
drop policy if exists "Members can view community posts" on public.community_posts;
create policy "Members can view community posts" on public.community_posts for select to authenticated using (true);
drop policy if exists "Community members can publish posts" on public.community_posts;
create policy "Community members can publish posts" on public.community_posts for insert to authenticated with check (user_id=(select auth.uid()) and exists(select 1 from public.community_members cm where cm.community_id=community_posts.community_id and cm.user_id=(select auth.uid())));
drop policy if exists "Authors or community owners can delete posts" on public.community_posts;
create policy "Authors or community owners can delete posts" on public.community_posts for delete to authenticated using (user_id=(select auth.uid()) or exists(select 1 from public.communities c where c.id=community_id and c.created_by=(select auth.uid())));
