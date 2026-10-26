-- Separate signaling rows for WHATSMYGRAM WebRTC calls.
-- Existing MYGRAM Chat signaling remains isolated in public.call_signals.
create table if not exists public.whatsmygram_call_signals (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.whatsmygram_chats(id) on delete cascade,
  call_id uuid not null,
  sender_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  signal_type text not null check (signal_type in ('offer','answer','ice','hangup','reject')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload)='object' and octet_length(payload::text) <= 65536),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (sender_id <> target_user_id),
  check (expires_at > created_at and expires_at <= created_at + interval '15 minutes')
);
create index if not exists whatsmygram_call_signals_target_idx
on public.whatsmygram_call_signals(target_user_id,created_at desc);
create index if not exists whatsmygram_call_signals_call_idx
on public.whatsmygram_call_signals(chat_id,call_id,created_at);

alter table public.whatsmygram_call_signals enable row level security;
revoke all on public.whatsmygram_call_signals from public,anon;
grant select,insert,delete on public.whatsmygram_call_signals to authenticated;

drop policy if exists whatsmygram_call_signals_read_participants on public.whatsmygram_call_signals;
create policy whatsmygram_call_signals_read_participants
on public.whatsmygram_call_signals for select to authenticated
using (
  expires_at > now()
  and (sender_id=(select auth.uid()) or target_user_id=(select auth.uid()))
  and private.is_whatsmygram_member(chat_id)
);

drop policy if exists whatsmygram_call_signals_insert_member on public.whatsmygram_call_signals;
create policy whatsmygram_call_signals_insert_member
on public.whatsmygram_call_signals for insert to authenticated
with check (
  sender_id=(select auth.uid())
  and target_user_id<>(select auth.uid())
  and expires_at > now()
  and expires_at <= now() + interval '15 minutes'
  and private.is_whatsmygram_member(chat_id)
  and exists (
    select 1 from public.whatsmygram_chat_members target
    where target.chat_id=whatsmygram_call_signals.chat_id
      and target.user_id=whatsmygram_call_signals.target_user_id
  )
);

drop policy if exists whatsmygram_call_signals_delete_participants on public.whatsmygram_call_signals;
create policy whatsmygram_call_signals_delete_participants
on public.whatsmygram_call_signals for delete to authenticated
using (
  (sender_id=(select auth.uid()) or target_user_id=(select auth.uid()))
  and private.is_whatsmygram_member(chat_id)
);

do $publication$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname='supabase_realtime' and schemaname='public' and tablename='whatsmygram_call_signals'
     )
  then
    execute 'alter publication supabase_realtime add table public.whatsmygram_call_signals';
  end if;
end
$publication$;
