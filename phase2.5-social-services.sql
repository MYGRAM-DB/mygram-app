-- MYGRAM 2.5: additive social services schema.
-- Run once in Supabase SQL Editor. No existing posts/users are deleted.
BEGIN;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS cover_url TEXT;

CREATE TABLE IF NOT EXISTS public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image','video')),
  caption TEXT NOT NULL DEFAULT '' CHECK (char_length(caption) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX IF NOT EXISTS stories_created_idx ON public.stories(created_at DESC);
CREATE INDEX IF NOT EXISTS stories_expiry_idx ON public.stories(expires_at);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '' CHECK (char_length(body) <= 5000),
  media_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  CONSTRAINT messages_not_empty CHECK (char_length(trim(body)) > 0 OR media_url IS NOT NULL),
  CONSTRAINT messages_not_self CHECK (sender_id <> recipient_id)
);
CREATE INDEX IF NOT EXISTS messages_pair_created_idx ON public.messages(sender_id, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_recipient_unread_idx ON public.messages(recipient_id, read_at) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS public.reels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '' CHECK (char_length(caption) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reels_created_idx ON public.reels(created_at DESC);

CREATE TABLE IF NOT EXISTS public.live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'بث مباشر على MYGRAM',
  provider TEXT NOT NULL DEFAULT 'external-provider-required',
  playback_url TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','ended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='stories' AND policyname='MYGRAM stories read active') THEN
    CREATE POLICY "MYGRAM stories read active" ON public.stories FOR SELECT TO authenticated USING (expires_at > now());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='stories' AND policyname='MYGRAM users create own stories') THEN
    CREATE POLICY "MYGRAM users create own stories" ON public.stories FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='stories' AND policyname='MYGRAM users delete own stories') THEN
    CREATE POLICY "MYGRAM users delete own stories" ON public.stories FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='messages' AND policyname='MYGRAM participants read messages') THEN
    CREATE POLICY "MYGRAM participants read messages" ON public.messages FOR SELECT TO authenticated USING (sender_id = (SELECT auth.uid()) OR recipient_id = (SELECT auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='messages' AND policyname='MYGRAM users send messages') THEN
    CREATE POLICY "MYGRAM users send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = (SELECT auth.uid()) AND recipient_id <> (SELECT auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='messages' AND policyname='MYGRAM recipient marks read') THEN
    CREATE POLICY "MYGRAM recipient marks read" ON public.messages FOR UPDATE TO authenticated USING (recipient_id = (SELECT auth.uid())) WITH CHECK (recipient_id = (SELECT auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reels' AND policyname='MYGRAM authenticated read reels') THEN
    CREATE POLICY "MYGRAM authenticated read reels" ON public.reels FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reels' AND policyname='MYGRAM users create own reels') THEN
    CREATE POLICY "MYGRAM users create own reels" ON public.reels FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reels' AND policyname='MYGRAM users delete own reels') THEN
    CREATE POLICY "MYGRAM users delete own reels" ON public.reels FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='live_sessions' AND policyname='MYGRAM authenticated read live sessions') THEN
    CREATE POLICY "MYGRAM authenticated read live sessions" ON public.live_sessions FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='live_sessions' AND policyname='MYGRAM users create own live sessions') THEN
    CREATE POLICY "MYGRAM users create own live sessions" ON public.live_sessions FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='live_sessions' AND policyname='MYGRAM owners update own live sessions') THEN
    CREATE POLICY "MYGRAM owners update own live sessions" ON public.live_sessions FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END $$;

GRANT SELECT, INSERT, DELETE ON public.stories TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.reels TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.live_sessions TO authenticated;
GRANT SELECT, UPDATE ON public.users TO authenticated;

COMMIT;
