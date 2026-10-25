-- Remove unused anonymous-role table privileges from social data.
-- RLS policies for these tables are restricted to authenticated users.
REVOKE ALL PRIVILEGES ON TABLE
  public.chat_members,
  public.chats,
  public.communities,
  public.community_members,
  public.community_posts,
  public.friend_requests,
  public.live_sessions,
  public.post_comments,
  public.post_reactions,
  public.posts,
  public.profiles,
  public.reel_comments,
  public.reel_reactions,
  public.reels,
  public.stories
FROM anon;