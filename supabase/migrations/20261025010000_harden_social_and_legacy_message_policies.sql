-- Harden legacy messaging and complete owner controls without dropping data.
-- The legacy messages table has only sender_id/chat_id, so it cannot safely expose
-- recipient messages; restrict it to each sender until the app migrates fully to direct_messages.
drop policy if exists "legacy_messages_select_own_sender" on public.messages;
create policy "legacy_messages_select_own_sender"
on public.messages for select to authenticated
using (sender_id = (select auth.uid())::text);

drop policy if exists "legacy_messages_insert_own_sender" on public.messages;
create policy "legacy_messages_insert_own_sender"
on public.messages for insert to authenticated
with check (sender_id = (select auth.uid())::text);

drop policy if exists "legacy_messages_update_own_sender" on public.messages;
create policy "legacy_messages_update_own_sender"
on public.messages for update to authenticated
using (sender_id = (select auth.uid())::text)
with check (sender_id = (select auth.uid())::text);

drop policy if exists "legacy_messages_delete_own_sender" on public.messages;
create policy "legacy_messages_delete_own_sender"
on public.messages for delete to authenticated
using (sender_id = (select auth.uid())::text);

-- Let authors edit/delete only their own posts. Existing read/insert policies remain intact.
drop policy if exists "posts_update_own" on public.posts;
create policy "posts_update_own"
on public.posts for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_delete_own"
on public.posts for delete to authenticated
using (user_id = (select auth.uid()));

-- Keep friendship endpoints immutable after creation and permit only valid state transitions.
create or replace function public.guard_friend_request_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if new.id is distinct from old.id
     or new.requester_id is distinct from old.requester_id
     or new.receiver_id is distinct from old.receiver_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Friend request participants and identity are immutable';
  end if;

  if actor = old.receiver_id
     and old.status = 'pending'
     and new.status in ('accepted', 'rejected') then
    return new;
  end if;

  if actor = old.requester_id
     and old.status = 'rejected'
     and new.status = 'pending' then
    return new;
  end if;

  raise exception 'Invalid friend request state transition';
end;
$$;

drop trigger if exists guard_friend_request_update on public.friend_requests;
create trigger guard_friend_request_update
before update on public.friend_requests
for each row execute function public.guard_friend_request_update();

drop policy if exists "MYGRAM respond to friend requests" on public.friend_requests;
create policy "MYGRAM respond to friend requests"
on public.friend_requests for update to authenticated
using (
  (receiver_id = (select auth.uid()) and status = 'pending')
  or
  (requester_id = (select auth.uid()) and status = 'rejected')
)
with check (
  (receiver_id = (select auth.uid()) and status in ('accepted', 'rejected'))
  or
  (requester_id = (select auth.uid()) and status = 'pending')
);
