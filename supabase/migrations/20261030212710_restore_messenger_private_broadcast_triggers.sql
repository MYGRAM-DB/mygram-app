BEGIN;

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

DROP TRIGGER IF EXISTS messenger_messages_broadcast_insert
ON public.messenger_messages;

CREATE TRIGGER messenger_messages_broadcast_insert
AFTER INSERT ON public.messenger_messages
FOR EACH ROW
EXECUTE FUNCTION mygram_private.messenger_broadcast_message();

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

DROP TRIGGER IF EXISTS messenger_attachments_broadcast_insert
ON public.messenger_attachments;

CREATE TRIGGER messenger_attachments_broadcast_insert
AFTER INSERT ON public.messenger_attachments
FOR EACH ROW
EXECUTE FUNCTION mygram_private.messenger_broadcast_attachment();

COMMIT;
