BEGIN;

CREATE SCHEMA IF NOT EXISTS mygram_private;
REVOKE ALL ON SCHEMA mygram_private FROM PUBLIC, anon, authenticated;

CREATE TABLE public.messenger_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_low uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_high uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz,
  CONSTRAINT messenger_conversations_distinct_users CHECK (user_low <> user_high),
  CONSTRAINT messenger_conversations_canonical_pair CHECK (user_low < user_high),
  CONSTRAINT messenger_conversations_creator_is_member CHECK (created_by IN (user_low, user_high)),
  CONSTRAINT messenger_conversations_id_members_unique UNIQUE (id, user_low, user_high)
);

CREATE UNIQUE INDEX messenger_conversations_direct_pair_uidx
  ON public.messenger_conversations (user_low, user_high);

CREATE TABLE public.messenger_participants (
  conversation_id uuid NOT NULL REFERENCES public.messenger_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX messenger_participants_user_conversation_idx
  ON public.messenger_participants (user_id, conversation_id);

CREATE TABLE public.messenger_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.messenger_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  client_message_id uuid,
  message_type text NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'image', 'video', 'audio', 'file')),
  body text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messenger_messages_body_valid CHECK (
    (message_type = 'text' AND body IS NOT NULL AND char_length(btrim(body)) BETWEEN 1 AND 10000)
    OR (message_type <> 'text' AND (body IS NULL OR char_length(body) <= 10000))
  ),
  CONSTRAINT messenger_messages_id_conversation_unique UNIQUE (id, conversation_id),
  CONSTRAINT messenger_messages_client_id_unique UNIQUE (sender_id, client_message_id)
);

CREATE INDEX messenger_messages_conversation_created_idx
  ON public.messenger_messages (conversation_id, created_at DESC, id DESC);

CREATE TABLE public.messenger_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.messenger_conversations(id) ON DELETE CASCADE,
  message_id uuid NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  object_path text NOT NULL UNIQUE,
  mime_type text NOT NULL CHECK (mime_type IN (
    'image/jpeg', 'image/png', 'image/webp', 'image/avif',
    'video/mp4', 'video/webm',
    'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/webm', 'audio/wav',
    'application/pdf'
  )),
  byte_size bigint NOT NULL CHECK (byte_size BETWEEN 1 AND 26214400),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messenger_attachments_message_same_conversation_fk
    FOREIGN KEY (message_id, conversation_id)
    REFERENCES public.messenger_messages(id, conversation_id)
    ON DELETE CASCADE
);

CREATE INDEX messenger_attachments_conversation_message_idx
  ON public.messenger_attachments (conversation_id, message_id);

ALTER TABLE public.messenger_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messenger_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messenger_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messenger_attachments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.messenger_conversations,
  public.messenger_participants,
  public.messenger_messages,
  public.messenger_attachments
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT ON TABLE public.messenger_conversations TO authenticated;
GRANT SELECT ON TABLE public.messenger_participants TO authenticated;
GRANT SELECT, INSERT ON TABLE public.messenger_messages TO authenticated;
GRANT SELECT, INSERT ON TABLE public.messenger_attachments TO authenticated;

CREATE POLICY messenger_conversations_select_member
ON public.messenger_conversations
FOR SELECT TO authenticated
USING (
  (select auth.uid()) = user_low
  OR (select auth.uid()) = user_high
);

CREATE POLICY messenger_conversations_insert_self_pair
ON public.messenger_conversations
FOR INSERT TO authenticated
WITH CHECK (
  created_by = (select auth.uid())
  AND (
    user_low = (select auth.uid())
    OR user_high = (select auth.uid())
  )
);

CREATE POLICY messenger_participants_select_member
ON public.messenger_participants
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.messenger_conversations c
    WHERE c.id = messenger_participants.conversation_id
      AND (
        c.user_low = (select auth.uid())
        OR c.user_high = (select auth.uid())
      )
  )
);

CREATE POLICY messenger_messages_select_member
ON public.messenger_messages
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.messenger_conversations c
    WHERE c.id = messenger_messages.conversation_id
      AND (
        c.user_low = (select auth.uid())
        OR c.user_high = (select auth.uid())
      )
  )
);

CREATE POLICY messenger_messages_insert_as_self
ON public.messenger_messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_id = (select auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.messenger_conversations c
    WHERE c.id = messenger_messages.conversation_id
      AND (
        c.user_low = (select auth.uid())
        OR c.user_high = (select auth.uid())
      )
  )
);

CREATE POLICY messenger_attachments_select_member
ON public.messenger_attachments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.messenger_conversations c
    WHERE c.id = messenger_attachments.conversation_id
      AND (
        c.user_low = (select auth.uid())
        OR c.user_high = (select auth.uid())
      )
  )
);

CREATE POLICY messenger_attachments_insert_own_message
ON public.messenger_attachments
FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = (select auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.messenger_messages m
    JOIN public.messenger_conversations c ON c.id = m.conversation_id
    WHERE m.id = messenger_attachments.message_id
      AND m.conversation_id = messenger_attachments.conversation_id
      AND m.sender_id = (select auth.uid())
      AND (
        c.user_low = (select auth.uid())
        OR c.user_high = (select auth.uid())
      )
  )
);

CREATE OR REPLACE FUNCTION mygram_private.messenger_create_participants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NEW.created_by <> auth.uid() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'AUTHENTICATION_REQUIRED';
  END IF;

  INSERT INTO public.messenger_participants (conversation_id, user_id, role)
  VALUES
    (NEW.id, NEW.created_by, 'owner'),
    (
      NEW.id,
      CASE WHEN NEW.created_by = NEW.user_low THEN NEW.user_high ELSE NEW.user_low END,
      'member'
    );

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION mygram_private.messenger_create_participants()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER messenger_conversations_create_participants
AFTER INSERT ON public.messenger_conversations
FOR EACH ROW
EXECUTE FUNCTION mygram_private.messenger_create_participants();

CREATE OR REPLACE FUNCTION mygram_private.messenger_broadcast_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM realtime.broadcast_changes(
    'messenger:' || NEW.conversation_id::text || ':messages',
    'INSERT',
    'INSERT',
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    NULL
  );
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION mygram_private.messenger_broadcast_message()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER messenger_messages_broadcast_insert
AFTER INSERT ON public.messenger_messages
FOR EACH ROW
EXECUTE FUNCTION mygram_private.messenger_broadcast_message();

CREATE OR REPLACE FUNCTION mygram_private.messenger_touch_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  UPDATE public.messenger_conversations
  SET last_message_at = NEW.created_at,
      updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION mygram_private.messenger_touch_conversation()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER messenger_messages_touch_conversation
AFTER INSERT ON public.messenger_messages
FOR EACH ROW
EXECUTE FUNCTION mygram_private.messenger_touch_conversation();

CREATE OR REPLACE FUNCTION mygram_private.messenger_broadcast_attachment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM realtime.broadcast_changes(
    'messenger:' || NEW.conversation_id::text || ':messages',
    'INSERT',
    'INSERT',
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    NULL
  );
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION mygram_private.messenger_broadcast_attachment()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER messenger_attachments_broadcast_insert
AFTER INSERT ON public.messenger_attachments
FOR EACH ROW
EXECUTE FUNCTION mygram_private.messenger_broadcast_attachment();

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'realtime'
      AND tablename = 'messages'
      AND policyname = 'messenger_members_receive_private_broadcast'
  ) THEN
    CREATE POLICY messenger_members_receive_private_broadcast
    ON realtime.messages
    FOR SELECT TO authenticated
    USING (
      extension = 'broadcast'
      AND EXISTS (
        SELECT 1
        FROM public.messenger_conversations c
        WHERE (select realtime.topic()) = 'messenger:' || c.id::text || ':messages'
          AND (
            c.user_low = (select auth.uid())
            OR c.user_high = (select auth.uid())
          )
      )
    );
  END IF;
END;
$policy$;

INSERT INTO storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
VALUES (
  'messenger-attachments',
  'messenger-attachments',
  false,
  26214400,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/avif',
    'video/mp4', 'video/webm',
    'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/webm', 'audio/wav',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY messenger_attachments_storage_select_member
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'messenger-attachments'
  AND EXISTS (
    SELECT 1
    FROM public.messenger_conversations c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (
        c.user_low = (select auth.uid())
        OR c.user_high = (select auth.uid())
      )
  )
);

CREATE POLICY messenger_attachments_storage_insert_member_own_folder
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'messenger-attachments'
  AND (storage.foldername(name))[2] = (select auth.uid()::text)
  AND EXISTS (
    SELECT 1
    FROM public.messenger_conversations c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (
        c.user_low = (select auth.uid())
        OR c.user_high = (select auth.uid())
      )
  )
);

CREATE POLICY messenger_attachments_storage_update_own
ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'messenger-attachments'
  AND (storage.foldername(name))[2] = (select auth.uid()::text)
  AND EXISTS (
    SELECT 1
    FROM public.messenger_conversations c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (
        c.user_low = (select auth.uid())
        OR c.user_high = (select auth.uid())
      )
  )
)
WITH CHECK (
  bucket_id = 'messenger-attachments'
  AND (storage.foldername(name))[2] = (select auth.uid()::text)
  AND EXISTS (
    SELECT 1
    FROM public.messenger_conversations c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (
        c.user_low = (select auth.uid())
        OR c.user_high = (select auth.uid())
      )
  )
);

CREATE POLICY messenger_attachments_storage_delete_own
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'messenger-attachments'
  AND (storage.foldername(name))[2] = (select auth.uid()::text)
  AND EXISTS (
    SELECT 1
    FROM public.messenger_conversations c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (
        c.user_low = (select auth.uid())
        OR c.user_high = (select auth.uid())
      )
  )
);

COMMENT ON TABLE public.messenger_conversations IS
  'Direct Messenger conversations; only the two canonical participant IDs can read them.';
COMMENT ON TABLE public.messenger_participants IS
  'Server-created membership rows for direct Messenger conversations; clients have read-only access.';
COMMENT ON TABLE public.messenger_messages IS
  'Immutable direct Messenger messages; sender identity is enforced by RLS.';
COMMENT ON TABLE public.messenger_attachments IS
  'Private attachment metadata. Binary objects live in the private messenger-attachments Storage bucket.';
COMMENT ON SCHEMA mygram_private IS
  'Non-exposed internal trigger functions for MYGRAM products.';

COMMIT;
