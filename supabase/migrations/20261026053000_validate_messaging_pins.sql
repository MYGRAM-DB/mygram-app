-- A pin must always point to a message from the same conversation and source.
create or replace function private.validate_messaging_pin_target()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare v_chat_id uuid;
begin
  if new.source = 'messenger' then
    select chat_id into v_chat_id from public.chat_messages where id = new.message_id;
  elsif new.source = 'whatsmygram' then
    select chat_id into v_chat_id from public.whatsmygram_messages where id = new.message_id;
  else
    raise exception 'Unsupported messaging source.';
  end if;
  if v_chat_id is distinct from new.space_id then
    raise exception 'Pinned message must belong to the same conversation and source.';
  end if;
  if not private.is_messaging_member(new.source,new.space_id,auth.uid()) then
    raise exception 'Only conversation members can pin or manage pinned messages.';
  end if;
  if not private.can_manage_messaging_space(new.source,new.space_id,'pin',auth.uid()) then
    raise exception 'Only space creators or members with pin permission can manage pinned messages.';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_messaging_pin_target() from public, anon;
drop trigger if exists validate_messaging_pin_target on public.messaging_pins;
create trigger validate_messaging_pin_target
before insert or update of source,space_id,message_id,pinned_by on public.messaging_pins
for each row execute function private.validate_messaging_pin_target();

-- Also ensure a meeting's live chat cannot be altered after the room is ended.
create or replace function private.validate_meeting_message_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare v_status text; v_creator uuid; v_chair uuid;
begin
  select status,created_by,chair_user_id into v_status,v_creator,v_chair
  from public.meetings where id = new.meeting_id;
  if not found then raise exception 'Meeting not found.'; end if;
  if v_status not in ('scheduled','live') then raise exception 'Meeting chat is closed.'; end if;
  if tg_op = 'INSERT' then
    if new.sender_id is distinct from auth.uid() then
      raise exception 'Message sender must match the authenticated user.';
    end if;
  else
    if old.sender_id is distinct from auth.uid() then
      raise exception 'Only the message author may edit it.';
    end if;
    if new.sender_id is distinct from old.sender_id or new.meeting_id is distinct from old.meeting_id then
      raise exception 'Message author and meeting cannot be changed.';
    end if;
  end if;
  if not private.is_meeting_member(new.meeting_id,auth.uid()) then
    raise exception 'Only active meeting participants may send or edit messages.';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_meeting_message_write() from public, anon;
drop trigger if exists validate_meeting_message_write on public.meeting_messages;
create trigger validate_meeting_message_write
before insert or update on public.meeting_messages
for each row execute function private.validate_meeting_message_write();
