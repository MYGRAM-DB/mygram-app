-- Cover frequently queried foreign-key columns so feed and messaging lookups stay efficient.
CREATE INDEX IF NOT EXISTS direct_messages_sender_created_idx ON public.direct_messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS direct_messages_recipient_created_idx ON public.direct_messages (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS live_sessions_user_id_idx ON public.live_sessions (user_id);
CREATE INDEX IF NOT EXISTS post_comments_post_created_idx ON public.post_comments (post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS post_comments_user_id_idx ON public.post_comments (user_id);
CREATE INDEX IF NOT EXISTS post_comments_parent_comment_id_idx ON public.post_comments (parent_comment_id);
CREATE INDEX IF NOT EXISTS post_reactions_user_id_idx ON public.post_reactions (user_id);
CREATE INDEX IF NOT EXISTS posts_user_created_idx ON public.posts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reels_user_created_idx ON public.reels (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stories_user_created_idx ON public.stories (user_id, created_at DESC);
