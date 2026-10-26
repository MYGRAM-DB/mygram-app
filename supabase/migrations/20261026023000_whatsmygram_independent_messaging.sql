-- Separate WHATSMYGRAM conversations and messages from MYGRAM Messenger.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.whatsmygram_chats (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  is_group boolean not null default false,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsmygram_chat_title_length check (title is null or char_length(btrim(title)) between 1 and 100)
);

create table if not exists public.whatsmygram_chat_members (
  chat_id uuid not null references public.whatsmygram_chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (chat_id, user_id)
);
create index if not exists whatsmygram_members_user_idx
  on public.whatsmygram_chat_members(user_id, chat_id);

create table if not exists public.whatsmygram_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.whatsmygram_chats(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  attachment_url text,
  attachment_type text check (attachment_type is null or attachment_type in ('image','video','audio')),
  duration_seconds integer check (duration_seconds is null or duration_seconds between 1 and 600),
  created_at timestamptz not null default now(),
  constraint whatsmygram_attachment_pair check (
    (attachment_url is null and attachment_type is null) or
    (attachment_url is not null and attachment_type is not null)
  )
);
create index if not exists whatsmygram_messages_chat_created_idx
  on public.whatsmygram_messages(chat_id, created_at desc);

create or replace function private.is_whatsmygram_creator(target_chat_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $function$
  select exists (
    select 1 from public.whatsmygram_chats c
    where c.id = target_chat_id and c.created_by = (select auth.uid())
  );
$function$;
revoke all on function private.is_whatsmygram_creator(uuid) from public, anon;
grant execute on function private.is_whatsmygram_creator(uuid) to authenticated;

create or replace function private.is_whatsmygram_member(target_chat_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $function$
  select exists (
    select 1 from public.whatsmygram_chat_members cm
    where cm.chat_id = target_chat_id and cm.user_id = (select auth.uid())
  );
$function$;
revoke all on function private.is_whatsmygram_member(uuid) from public, anon;
grant execute on function private.is_whatsmygram_member(uuid) to authenticated;

alter table public.whatsmygram_chats enable row level security;
alter table public.whatsmygram_chat_members enable row level security;
alter table public.whatsmygram_messages enable row level security;

revoke all on public.whatsmygram_chats, public.whatsmygram_chat_members, public.whatsmygram_messages from public, anon;
grant select, insert, update, delete on public.whatsmygram_chats to authenticated;
grant select, insert, delete on public.whatsmygram_chat_members to authenticated;
grant update (last_read_at) on public.whatsmygram_chat_members to authenticated;
grant select, insert, delete on public.whatsmygram_messages to authenticated;

drop policy if exists whatsmygram_chats_select_members on public.whatsmygram_chats;
create policy whatsmygram_chats_select_members on public.whatsmygram_chats
  for select to authenticated
  using (created_by = (select auth.uid()) or private.is_whatsmygram_member(id));

drop policy if exists whatsmygram_chats_insert_creator on public.whatsmygram_chats;
create policy whatsmygram_chats_insert_creator on public.whatsmygram_chats
  for insert to authenticated
  with check (created_by = (select auth.uid()));

drop policy if exists whatsmygram_chats_update_creator on public.whatsmygram_chats;
create policy whatsmygram_chats_update_creator on public.whatsmygram_chats
  for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

drop policy if exists whatsmygram_chats_delete_creator on public.whatsmygram_chats;
create policy whatsmygram_chats_delete_creator on public.whatsmygram_chats
  for delete to authenticated
  using (created_by = (select auth.uid()));

drop policy if exists whatsmygram_members_select_members on public.whatsmygram_chat_members;
create policy whatsmygram_members_select_members on public.whatsmygram_chat_members
  for select to authenticated
  using (private.is_whatsmygram_member(chat_id));

drop policy if exists whatsmygram_members_insert_creator on public.whatsmygram_chat_members;
create policy whatsmygram_members_insert_creator on public.whatsmygram_chat_members
  for insert to authenticated
  with check (private.is_whatsmygram_creator(chat_id));

drop policy if exists whatsmygram_members_update_own_read_state on public.whatsmygram_chat_members;
create policy whatsmygram_members_update_own_read_state on public.whatsmygram_chat_members
  for update to authenticated
  using (user_id = (select auth.uid()) and private.is_whatsmygram_member(chat_id))
  with check (user_id = (select auth.uid()) and private.is_whatsmygram_member(chat_id));

drop policy if exists whatsmygram_members_delete_self_or_creator on public.whatsmygram_chat_members;
create policy whatsmygram_members_delete_self_or_creator on public.whatsmygram_chat_members
  for delete to authenticated
  using (user_id = (select auth.uid()) or private.is_whatsmygram_creator(chat_id));

drop policy if exists whatsmygram_messages_select_members on public.whatsmygram_messages;
create policy whatsmygram_messages_select_members on public.whatsmygram_messages
  for select to authenticated
  using (private.is_whatsmygram_member(chat_id));

drop policy if exists whatsmygram_messages_insert_members on public.whatsmygram_messages;
create policy whatsmygram_messages_insert_members on public.whatsmygram_messages
  for insert to authenticated
  with check (sender_id = (select auth.uid()) and private.is_whatsmygram_member(chat_id));

drop policy if exists whatsmygram_messages_delete_own on public.whatsmygram_messages;
create policy whatsmygram_messages_delete_own on public.whatsmygram_messages
  for delete to authenticated
  using (sender_id = (select auth.uid()) and private.is_whatsmygram_member(chat_id));

-- Presence is visible only within shared chat relationships, including WHATSMYGRAM.
create or replace function private.can_view_mygram_presence(target_user_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $function$
  select coalesce(
    (select auth.uid()) is not null
    and $1 is not null
    and $1 <> (select auth.uid())
    and (
      exists (
        select 1 from public.chat_members viewer
        join public.chat_members target on target.chat_id = viewer.chat_id
        where viewer.user_id = (select auth.uid()) and target.user_id = $1
      )
      or exists (
        select 1 from public.direct_messages dm
        where (dm.sender_id = (select auth.uid()) and dm.recipient_id = $1)
           or (dm.recipient_id = (select auth.uid()) and dm.sender_id = $1)
      )
      or exists (
        select 1 from public.whatsmygram_chat_members viewer
        join public.whatsmygram_chat_members target on target.chat_id = viewer.chat_id
        where viewer.user_id = (select auth.uid()) and target.user_id = $1
      )
    ),
    false
  );
$function$;
revoke all on function private.can_view_mygram_presence(uuid) from public, anon;
grant execute on function private.can_view_mygram_presence(uuid) to authenticated;

drop policy if exists "MYGRAM whatsmygram media read participants" on storage.objects;
create policy "MYGRAM whatsmygram media read participants"
on storage.objects for select to authenticated
using (
  bucket_id = 'mygram-private-messages'
  and exists (
    select 1 from public.whatsmygram_messages wm
    where wm.attachment_url = storage.objects.name
      and private.is_whatsmygram_member(wm.chat_id)
  )
);

do $publication$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'whatsmygram_messages'
     )
  then
    execute 'alter publication supabase_realtime add table public.whatsmygram_messages';
  end if;
end
$publication$;