-- STAGING ONLY: segregated airdrop balance + activity-based decay.
-- Gift balances are stored separately from public.wallets.balance_atomic. Transfers and purchases
-- continue to spend only the real wallet balance; this migration never debits that balance.
begin;

create table if not exists public.wallet_airdrop_balances (
  user_id uuid primary key references auth.users(id) on delete restrict,
  balance_atomic numeric(38,0) not null default 0 check (balance_atomic >= 0),
  granted_at timestamptz not null default now(),
  last_decay_on date,
  updated_at timestamptz not null default now()
);
alter table public.wallet_airdrop_balances enable row level security;
revoke all on public.wallet_airdrop_balances from public, anon, authenticated;
drop policy if exists wallet_airdrop_balance_select_own on public.wallet_airdrop_balances;
create policy wallet_airdrop_balance_select_own on public.wallet_airdrop_balances
  for select to authenticated using (user_id=(select auth.uid()));
grant select on public.wallet_airdrop_balances to authenticated;

create table if not exists public.user_activity_monitor (
  user_id uuid primary key references auth.users(id) on delete restrict,
  last_active_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_activity_monitor enable row level security;
revoke all on public.user_activity_monitor from public, anon, authenticated;

-- Append-only double-entry trail for gift balances only. It is deliberately separate from
-- wallet_ledger so an airdrop cannot be mistaken for purchased/earned wallet funds.
create table if not exists public.wallet_airdrop_ledger (
  id bigint generated always as identity primary key,
  transaction_id uuid not null references public.wallet_transactions(id) on delete restrict,
  user_id uuid references auth.users(id) on delete restrict,
  system_account_code text references public.wallet_system_accounts(code) on delete restrict,
  entry_kind text not null check (entry_kind in ('debit','credit')),
  amount_atomic numeric(38,0) not null check (amount_atomic > 0),
  created_at timestamptz not null default now(),
  check ((user_id is not null and system_account_code is null)
      or (user_id is null and system_account_code is not null))
);
create unique index if not exists wallet_airdrop_ledger_user_entry_unique
  on public.wallet_airdrop_ledger(transaction_id,user_id,entry_kind) where user_id is not null;
create unique index if not exists wallet_airdrop_ledger_system_entry_unique
  on public.wallet_airdrop_ledger(transaction_id,system_account_code,entry_kind)
  where system_account_code is not null;
create index if not exists wallet_airdrop_ledger_user_created_idx
  on public.wallet_airdrop_ledger(user_id,created_at desc);
alter table public.wallet_airdrop_ledger enable row level security;
revoke all on public.wallet_airdrop_ledger from public, anon, authenticated;
drop policy if exists wallet_airdrop_ledger_select_own on public.wallet_airdrop_ledger;
create policy wallet_airdrop_ledger_select_own on public.wallet_airdrop_ledger
  for select to authenticated using (user_id=(select auth.uid()));
grant select on public.wallet_airdrop_ledger to authenticated;

-- Make a user's own airdrop grant/decay transactions visible through the existing transaction
-- history policy without exposing system-account entries or other users' history.
drop policy if exists wallet_transactions_select_own on public.wallet_transactions;
create policy wallet_transactions_select_own on public.wallet_transactions
  for select to authenticated using (
    exists (select 1 from public.wallet_ledger l join public.wallets w on w.id=l.wallet_id
            where l.transaction_id=wallet_transactions.id and w.user_id=(select auth.uid()))
    or exists (select 1 from public.wallet_airdrop_ledger al
                where al.transaction_id=wallet_transactions.id and al.user_id=(select auth.uid()))
  );

-- The grace period is fixed at 30 days. Decay remains disabled until an operator approves
-- a rate; no economic rate is silently assumed by this migration.
create table if not exists public.wallet_airdrop_decay_policy (
  singleton boolean primary key default true check (singleton),
  grace_days integer not null default 30 check (grace_days = 30),
  decay_basis_points integer not null default 0 check (decay_basis_points between 0 and 10000),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.wallet_airdrop_decay_policy(singleton,grace_days,decay_basis_points,enabled)
values (true,30,0,false)
on conflict (singleton) do nothing;
alter table public.wallet_airdrop_decay_policy enable row level security;
revoke all on public.wallet_airdrop_decay_policy from public, anon, authenticated;

-- Replace the signup trigger implementation: the welcome grant credits ONLY the airdrop
-- bucket, not the spendable/purchased wallet balance.
create or replace function wallet_private.grant_signup_welcome()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, wallet_private
as $$
declare
  v_control public.wallet_grant_control%rowtype;
  v_tx uuid;
begin
  select * into v_control from public.wallet_grant_control
   where grant_name='signup_welcome' for update;
  if not found then raise exception 'welcome grant control missing'; end if;

  insert into public.wallets(user_id,asset_code,balance_atomic)
  values (new.id,'MYGRAM_COIN',0)
  on conflict (user_id,asset_code) do nothing;
  insert into public.user_activity_monitor(user_id,last_active_at)
  values(new.id,now()) on conflict(user_id) do nothing;

  if exists(select 1 from public.wallet_signup_grants where user_id=new.id) then
    return new;
  end if;

  if not v_control.enabled or v_control.granted_count >= v_control.max_recipients then
    insert into public.wallet_signup_grants(user_id,granted) values(new.id,false)
    on conflict (user_id) do nothing;
    return new;
  end if;

  insert into public.wallet_airdrop_balances(user_id,balance_atomic,granted_at)
  values(new.id,0,now()) on conflict(user_id) do nothing;

  update public.wallet_system_accounts
     set balance_atomic=balance_atomic-v_control.grant_amount
   where code=v_control.pool_account_code and asset_code='MYGRAM_COIN'
     and balance_atomic >= v_control.grant_amount;
  if not found then raise exception 'welcome pool exhausted'; end if;

  insert into public.wallet_transactions(idempotency_key,transaction_type,status,initiated_by,reference,metadata)
  values ('signup-welcome:'||new.id::text,'grant','pending',new.id,
          'first 5000000 signup cap',
          jsonb_build_object('grant_bucket','airdrop','grant_amount_atomic',v_control.grant_amount))
  returning id into v_tx;

  insert into public.wallet_airdrop_ledger(transaction_id,system_account_code,entry_kind,amount_atomic)
  values(v_tx,v_control.pool_account_code,'debit',v_control.grant_amount);
  insert into public.wallet_airdrop_ledger(transaction_id,user_id,entry_kind,amount_atomic)
  values(v_tx,new.id,'credit',v_control.grant_amount);

  update public.wallet_airdrop_balances
     set balance_atomic=balance_atomic+v_control.grant_amount,
         granted_at=now(),last_decay_on=null,updated_at=now()
   where user_id=new.id;
  update public.wallet_transactions set status='posted',posted_at=now() where id=v_tx;
  insert into public.wallet_signup_grants(user_id,granted,transaction_id)
  values(new.id,true,v_tx);
  update public.wallet_grant_control
     set granted_count=granted_count+1,updated_at=now()
   where grant_name='signup_welcome';
  return new;
end;
$$;
revoke all on function wallet_private.grant_signup_welcome() from public, anon, authenticated;

-- Authenticated clients may record a heartbeat, but cannot directly edit monitor/balance rows.
create or replace function public.record_user_activity()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, wallet_private
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'authentication required' using errcode='28000'; end if;
  insert into public.user_activity_monitor(user_id,last_active_at,updated_at)
  values(v_user,now(),now())
  on conflict(user_id) do update
    set last_active_at=greatest(public.user_activity_monitor.last_active_at,excluded.last_active_at),
        updated_at=now();
end;
$$;
revoke all on function public.record_user_activity() from public, anon;
grant execute on function public.record_user_activity() to authenticated;

-- Run from a trusted scheduler/operator context. Each user/day is serialized by row lock and
-- a unique idempotency key. Only airdrop balances are reduced; real wallet balances are untouched.
create or replace function wallet_private.process_daily_airdrop_decay()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, wallet_private
as $$
declare
  v_policy public.wallet_airdrop_decay_policy%rowtype;
  v_row record;
  v_decay numeric(38,0);
  v_tx uuid;
  v_processed integer := 0;
  v_today date := current_date;
begin
  select * into v_policy from public.wallet_airdrop_decay_policy
   where singleton=true for share;
  if not found or not v_policy.enabled or v_policy.decay_basis_points <= 0 then
    return 0;
  end if;

  for v_row in
    select b.user_id,b.balance_atomic,b.granted_at,b.last_decay_on,
           greatest(b.granted_at,coalesce(m.last_active_at,b.granted_at)) as grace_anchor
      from public.wallet_airdrop_balances b
      left join public.user_activity_monitor m on m.user_id=b.user_id
     where b.balance_atomic > 0
       and (b.last_decay_on is null or b.last_decay_on < v_today)
       and greatest(b.granted_at,coalesce(m.last_active_at,b.granted_at))
             <= now() - make_interval(days => v_policy.grace_days)
     order by b.user_id
     for update of b skip locked
  loop
    v_decay := least(v_row.balance_atomic,
      greatest(1::numeric, floor(v_row.balance_atomic*v_policy.decay_basis_points/10000)));
    if v_decay <= 0 then continue; end if;

    insert into public.wallet_transactions(idempotency_key,transaction_type,status,initiated_by,reference,metadata)
    values ('airdrop-decay:'||v_today::text||':'||v_row.user_id::text,
            'adjustment','pending',v_row.user_id,'daily airdrop decay',
            jsonb_build_object('bucket','airdrop','grace_days',v_policy.grace_days,
                               'decay_basis_points',v_policy.decay_basis_points))
    on conflict(idempotency_key) do nothing
    returning id into v_tx;

    if v_tx is null then
      update public.wallet_airdrop_balances set last_decay_on=v_today,updated_at=now()
       where user_id=v_row.user_id;
      continue;
    end if;

    insert into public.wallet_airdrop_ledger(transaction_id,user_id,entry_kind,amount_atomic)
    values(v_tx,v_row.user_id,'debit',v_decay);
    insert into public.wallet_airdrop_ledger(transaction_id,system_account_code,entry_kind,amount_atomic)
    values(v_tx,'welcome_pool','credit',v_decay);

    update public.wallet_airdrop_balances
       set balance_atomic=balance_atomic-v_decay,last_decay_on=v_today,updated_at=now()
     where user_id=v_row.user_id and balance_atomic >= v_decay;
    if not found then raise exception 'airdrop balance changed; retry' using errcode='40001'; end if;

    update public.wallet_system_accounts set balance_atomic=balance_atomic+v_decay
     where code='welcome_pool' and asset_code='MYGRAM_COIN';
    if not found then raise exception 'airdrop pool account missing'; end if;
    update public.wallet_transactions set status='posted',posted_at=now() where id=v_tx;
    v_processed := v_processed+1;
  end loop;
  return v_processed;
end;
$$;
revoke all on function wallet_private.process_daily_airdrop_decay() from public, anon, authenticated;

commit;
