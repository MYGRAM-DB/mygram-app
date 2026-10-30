BEGIN;

CREATE INDEX IF NOT EXISTS messenger_attachments_message_conversation_idx
  ON public.messenger_attachments (message_id, conversation_id);

CREATE INDEX IF NOT EXISTS messenger_attachments_uploaded_by_idx
  ON public.messenger_attachments (uploaded_by);

CREATE INDEX IF NOT EXISTS messenger_conversations_created_by_idx
  ON public.messenger_conversations (created_by);

CREATE INDEX IF NOT EXISTS messenger_conversations_user_high_idx
  ON public.messenger_conversations (user_high);

COMMIT;
