-- Cover foreign-key lookup paths discovered by Supabase performance advisors.
create index if not exists chats_created_by_idx on public.chats(created_by);
create index if not exists chat_messages_sender_idx on public.chat_messages(sender_id);
create index if not exists reel_comments_user_idx on public.reel_comments(user_id);
create index if not exists reel_reactions_user_idx on public.reel_reactions(user_id);
