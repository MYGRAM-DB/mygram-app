-- Tighten direct-message updates without changing existing rows or message-read behavior.
-- Only the recipient may update read_at; message content and attachment metadata are immutable.
create or replace function public.guard_direct_message_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null or old.recipient_id <> auth.uid() then
    raise exception 'Only the recipient may mark a message as read';
  end if;

  if new.id is distinct from old.id
     or new.sender_id is distinct from old.sender_id
     or new.recipient_id is distinct from old.recipient_id
     or new.body is distinct from old.body
     or new.attachment_url is distinct from old.attachment_url
     or new.attachment_type is distinct from old.attachment_type
     or new.duration_seconds is distinct from old.duration_seconds
     or new.created_at is distinct from old.created_at then
    raise exception 'Direct message content, attachment metadata, and participants are immutable';
  end if;

  if old.read_at is not null and new.read_at is distinct from old.read_at then
    raise exception 'Read receipt cannot be cleared or rewritten';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_direct_message_update() from public, anon, authenticated;
