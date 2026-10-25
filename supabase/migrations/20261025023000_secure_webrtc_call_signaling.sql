-- Secure, short-lived signaling records for browser-to-browser audio/video calls.
create table if not exists public.call_signals (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  call_id uuid not null,
  sender_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  signal_type text not null check (signal_type in ('offer','answer','ice','hangup','reject')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  constraint call_signals_no_self_call check (sender_id <> target_user_id),
  constraint call_signals_payload_size check (pg_column_size(payload) < 200000)
);
create index if not exists call_signals_target_recent_idx on public.call_signals(target_user_id, created_at desc);
create index if not exists call_signals_call_recent_idx on public.call_signals(call_id, created_at);

alter table public.call_signals enable row level security;
revoke all on public.call_signals from anon, public;
grant select, insert, delete on public.call_signals to authenticated;

drop policy if exists "Call participants can read their signals" on public.call_signals;
create policy "Call participants can read their signals"
on public.call_signals for select to authenticated
using (
  expires_at > now()
  and (sender_id = (select auth.uid()) or target_user_id = (select auth.uid()))
  and private.is_chat_member(chat_id)
);

drop policy if exists "Chat members can signal call participants" on public.call_signals;
create policy "Chat members can signal call participants"
on public.call_signals for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and target_user_id <> (select auth.uid())
  and expires_at > now()
  and expires_at <= now() + interval '15 minutes'
  and private.is_chat_member(chat_id)
  and exists (
    select 1 from public.chat_members cm
    where cm.chat_id = call_signals.chat_id and cm.user_id = call_signals.target_user_id
  )
);

drop policy if exists "Call participants can delete their signals" on public.call_signals;
create policy "Call participants can delete their signals"
on public.call_signals for delete to authenticated
using (
  (sender_id = (select auth.uid()) or target_user_id = (select auth.uid()))
  and private.is_chat_member(chat_id)
);

create or replace function private.prune_expired_call_signals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  delete from public.call_signals where expires_at < now();
  return new;
end;
$function$;
revoke all on function private.prune_expired_call_signals() from public, anon, authenticated;
drop trigger if exists prune_expired_call_signals on public.call_signals;
create trigger prune_expired_call_signals
before insert on public.call_signals
for each statement execute function private.prune_expired_call_signals();

do $publication$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'call_signals'
  ) then
    alter publication supabase_realtime add table public.call_signals;
  end if;
end;
$publication$;
