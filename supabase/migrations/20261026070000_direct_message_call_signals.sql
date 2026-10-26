-- Private audio/video signaling for MYGRAM Messenger direct-message threads.
-- Calls are allowed only when the two users already have a direct-message relationship.
create table if not exists public.direct_call_signals (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null,
  sender_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  signal_type text not null check (signal_type in ('offer','answer','ice','hangup','reject')),
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload)='object' and octet_length(payload::text) <= 65536),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (sender_id <> target_user_id),
  check (expires_at > created_at and expires_at <= created_at + interval '10 minutes')
);
create index if not exists direct_call_signals_target_idx
  on public.direct_call_signals(target_user_id,created_at desc);
create index if not exists direct_call_signals_call_idx
  on public.direct_call_signals(call_id,created_at);

alter table public.direct_call_signals enable row level security;
revoke all on public.direct_call_signals from public,anon;
grant select,insert,delete on public.direct_call_signals to authenticated;

drop policy if exists direct_call_signals_read_participants on public.direct_call_signals;
create policy direct_call_signals_read_participants
on public.direct_call_signals for select to authenticated
using (
  expires_at > now()
  and (sender_id=(select auth.uid()) or target_user_id=(select auth.uid()))
  and exists (
    select 1 from public.direct_messages dm
    where (dm.sender_id=direct_call_signals.sender_id and dm.recipient_id=direct_call_signals.target_user_id)
       or (dm.sender_id=direct_call_signals.target_user_id and dm.recipient_id=direct_call_signals.sender_id)
  )
);

drop policy if exists direct_call_signals_insert_participants on public.direct_call_signals;
create policy direct_call_signals_insert_participants
on public.direct_call_signals for insert to authenticated
with check (
  sender_id=(select auth.uid())
  and target_user_id<>(select auth.uid())
  and expires_at > now()
  and expires_at <= now() + interval '10 minutes'
  and exists (
    select 1 from public.direct_messages dm
    where (dm.sender_id=direct_call_signals.sender_id and dm.recipient_id=direct_call_signals.target_user_id)
       or (dm.sender_id=direct_call_signals.target_user_id and dm.recipient_id=direct_call_signals.sender_id)
  )
);

drop policy if exists direct_call_signals_delete_participants on public.direct_call_signals;
create policy direct_call_signals_delete_participants
on public.direct_call_signals for delete to authenticated
using (
  (sender_id=(select auth.uid()) or target_user_id=(select auth.uid()))
  and exists (
    select 1 from public.direct_messages dm
    where (dm.sender_id=direct_call_signals.sender_id and dm.recipient_id=direct_call_signals.target_user_id)
       or (dm.sender_id=direct_call_signals.target_user_id and dm.recipient_id=direct_call_signals.sender_id)
  )
);

do $publication$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables where pubname='supabase_realtime'
       and schemaname='public' and tablename='direct_call_signals'
     )
  then
    execute 'alter publication supabase_realtime add table public.direct_call_signals';
  end if;
end
$publication$;
