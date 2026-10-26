-- Reactions shared by MYGRAM Chat, WHATSMYGRAM and one-to-one Messenger.
create table if not exists public.messaging_message_reactions (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('messenger','whatsmygram','direct')),
  space_id uuid,
  message_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji = any (array['👍','❤️','😂','🎉','🔥','👏','🙏','😮','😢','👎']::text[])),
  created_at timestamptz not null default now(),
  check ((source='direct' and space_id is null) or (source<>'direct' and space_id is not null)),
  unique (source,message_id,user_id,emoji)
);
create index if not exists messaging_reactions_room_message_idx
  on public.messaging_message_reactions(source,space_id,message_id);
create index if not exists messaging_reactions_user_idx
  on public.messaging_message_reactions(user_id,created_at desc);

create or replace function private.validate_messaging_reaction()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_space uuid;
  v_sender uuid;
  v_recipient uuid;
begin
  if new.user_id is distinct from auth.uid() then
    raise exception 'Reaction author must match the authenticated user.';
  end if;
  if new.source='messenger' then
    select chat_id into v_space from public.chat_messages where id=new.message_id;
    if v_space is distinct from new.space_id then raise exception 'Reaction must target a message in the same chat.'; end if;
    if not private.is_messaging_member('messenger',new.space_id,auth.uid()) then raise exception 'Chat membership required.'; end if;
  elsif new.source='whatsmygram' then
    select chat_id into v_space from public.whatsmygram_messages where id=new.message_id;
    if v_space is distinct from new.space_id then raise exception 'Reaction must target a message in the same chat.'; end if;
    if not private.is_messaging_member('whatsmygram',new.space_id,auth.uid()) then raise exception 'Chat membership required.'; end if;
  elsif new.source='direct' then
    if new.space_id is not null then raise exception 'Direct-message reactions must not have a group space ID.'; end if;
    select sender_id,recipient_id into v_sender,v_recipient from public.direct_messages where id=new.message_id;
    if not found or (auth.uid() is distinct from v_sender and auth.uid() is distinct from v_recipient) then
      raise exception 'Only direct-message participants may react to a message.';
    end if;
  else
    raise exception 'Unsupported messaging source.';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_messaging_reaction() from public, anon;
drop trigger if exists validate_messaging_reaction on public.messaging_message_reactions;
create trigger validate_messaging_reaction
before insert or update of source,space_id,message_id,user_id,emoji on public.messaging_message_reactions
for each row execute function private.validate_messaging_reaction();

alter table public.messaging_message_reactions enable row level security;
drop policy if exists messaging_reactions_read_participants on public.messaging_message_reactions;
create policy messaging_reactions_read_participants on public.messaging_message_reactions
for select to authenticated
using (
  (source='messenger' and private.is_messaging_member(source,space_id) and exists (
    select 1 from public.chat_messages m where m.id=message_id and m.chat_id=space_id
  ))
  or (source='whatsmygram' and private.is_messaging_member(source,space_id) and exists (
    select 1 from public.whatsmygram_messages m where m.id=message_id and m.chat_id=space_id
  ))
  or (source='direct' and exists (
    select 1 from public.direct_messages m where m.id=message_id and (m.sender_id=(select auth.uid()) or m.recipient_id=(select auth.uid()))
  ))
);
drop policy if exists messaging_reactions_insert_self on public.messaging_message_reactions;
create policy messaging_reactions_insert_self on public.messaging_message_reactions
for insert to authenticated
with check (user_id=(select auth.uid()));
drop policy if exists messaging_reactions_delete_self on public.messaging_message_reactions;
create policy messaging_reactions_delete_self on public.messaging_message_reactions
for delete to authenticated using (user_id=(select auth.uid()));

grant select,insert,delete on public.messaging_message_reactions to authenticated;
do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    begin alter publication supabase_realtime add table public.messaging_message_reactions; exception when duplicate_object then null; when undefined_object then null; end;
  end if;
end;
$$;
