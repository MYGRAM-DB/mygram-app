-- Private online status for one-to-one and group conversation participants.
-- Users may update only their own row. If status is hidden, no last-seen timestamp is retained.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.can_view_mygram_presence(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    (select auth.uid()) is not null
    and $1 is not null
    and $1 <> (select auth.uid())
    and (
      exists (
        select 1
        from public.chat_members viewer
        join public.chat_members target on target.chat_id = viewer.chat_id
        where viewer.user_id = (select auth.uid())
          and target.user_id = $1
      )
      or exists (
        select 1
        from public.direct_messages dm
        where (dm.sender_id = (select auth.uid()) and dm.recipient_id = $1)
           or (dm.recipient_id = (select auth.uid()) and dm.sender_id = $1)
      )
    ),
    false
  );
$function$;

revoke all on function private.can_view_mygram_presence(uuid) from public, anon;
grant execute on function private.can_view_mygram_presence(uuid) to authenticated;

create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  show_online_status boolean not null default true,
  last_seen_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint user_presence_hidden_has_no_last_seen
    check (show_online_status or last_seen_at is null)
);

alter table public.user_presence enable row level security;
revoke all on public.user_presence from public, anon, authenticated;
grant select, insert on public.user_presence to authenticated;
grant update (show_online_status, last_seen_at, updated_at) on public.user_presence to authenticated;

drop policy if exists user_presence_read_self_or_chat_contact on public.user_presence;
create policy user_presence_read_self_or_chat_contact
on public.user_presence for select to authenticated
using (user_id = (select auth.uid()) or private.can_view_mygram_presence(user_id));

drop policy if exists user_presence_insert_self on public.user_presence;
create policy user_presence_insert_self
on public.user_presence for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists user_presence_update_self on public.user_presence;
create policy user_presence_update_self
on public.user_presence for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- Add optional duration metadata for voice notes in standalone MYGRAM Chat.
alter table public.chat_messages
  add column if not exists duration_seconds integer;

alter table public.chat_messages
  drop constraint if exists chat_messages_duration_seconds_check;

alter table public.chat_messages
  add constraint chat_messages_duration_seconds_check
  check (duration_seconds is null or duration_seconds between 1 and 600);

create index if not exists user_presence_last_seen_idx
  on public.user_presence (last_seen_at desc)
  where show_online_status = true;
