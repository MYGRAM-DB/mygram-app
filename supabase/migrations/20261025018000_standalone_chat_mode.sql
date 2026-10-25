-- Independent one-to-one/group-capable MYGRAM Chat mode, separate from direct_messages.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  is_group boolean not null default false,
  title text,
  created_at timestamptz not null default now()
);
create table if not exists public.chat_members (
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(chat_id,user_id)
);
create index if not exists chat_members_user_idx on public.chat_members(user_id,chat_id);
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  attachment_url text,
  attachment_type text check (attachment_type is null or attachment_type in ('image','video','audio')),
  created_at timestamptz not null default now(),
  constraint chat_message_attachment_pair check ((attachment_url is null and attachment_type is null) or (attachment_url is not null and attachment_type is not null))
);
create index if not exists chat_messages_chat_created_idx on public.chat_messages(chat_id,created_at);

create or replace function private.is_chat_creator(target_chat_id uuid)
returns boolean language sql stable security definer set search_path=''
as $function$
  select exists(select 1 from public.chats c where c.id=target_chat_id and c.created_by=(select auth.uid()));
$function$;
revoke all on function private.is_chat_creator(uuid) from public, anon;
grant execute on function private.is_chat_creator(uuid) to authenticated;

create or replace function private.is_chat_member(target_chat_id uuid)
returns boolean language sql stable security definer set search_path=''
as $function$
  select exists(select 1 from public.chat_members cm where cm.chat_id=target_chat_id and cm.user_id=(select auth.uid()));
$function$;
revoke all on function private.is_chat_member(uuid) from public, anon;
grant execute on function private.is_chat_member(uuid) to authenticated;

alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "Members can read their chats" on public.chats;
create policy "Members can read their chats" on public.chats for select to authenticated using (private.is_chat_member(id));
drop policy if exists "Users can create chats" on public.chats;
create policy "Users can create chats" on public.chats for insert to authenticated with check (created_by=(select auth.uid()));
drop policy if exists "Creators can update chat details" on public.chats;
create policy "Creators can update chat details" on public.chats for update to authenticated using (created_by=(select auth.uid())) with check (created_by=(select auth.uid()));
drop policy if exists "Members can view chat participants" on public.chat_members;
create policy "Members can view chat participants" on public.chat_members for select to authenticated using (private.is_chat_member(chat_id));
drop policy if exists "Creators can add chat members" on public.chat_members;
create policy "Creators can add chat members" on public.chat_members for insert to authenticated with check (private.is_chat_creator(chat_id));
drop policy if exists "Users can leave chats" on public.chat_members;
create policy "Users can leave chats" on public.chat_members for delete to authenticated using (user_id=(select auth.uid()) or private.is_chat_creator(chat_id));
drop policy if exists "Members can read chat messages" on public.chat_messages;
create policy "Members can read chat messages" on public.chat_messages for select to authenticated using (private.is_chat_member(chat_id));
drop policy if exists "Members can send their own chat messages" on public.chat_messages;
create policy "Members can send their own chat messages" on public.chat_messages for insert to authenticated with check (sender_id=(select auth.uid()) and private.is_chat_member(chat_id));
drop policy if exists "Senders can delete own chat messages" on public.chat_messages;
create policy "Senders can delete own chat messages" on public.chat_messages for delete to authenticated using (sender_id=(select auth.uid()) and private.is_chat_member(chat_id));

drop policy if exists "MYGRAM chat media read participants" on storage.objects;
create policy "MYGRAM chat media read participants" on storage.objects for select to authenticated using (
  bucket_id='mygram-private-messages'
  and exists(select 1 from public.chat_messages cm where cm.attachment_url=storage.objects.name and private.is_chat_member(cm.chat_id))
);
