-- Cover foreign keys reported by the Supabase performance advisor.
create index if not exists communities_created_by_idx on public.communities(created_by);
create index if not exists community_posts_user_idx on public.community_posts(user_id);
