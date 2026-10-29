-- STAGING ONLY: welcome grant + service settlement.
-- Requires the draft wallet schema, transfer RPC wrapper, and 30-row service catalog.
-- Do not apply to production before staging tests and review.
begin;

-- Internal accounts are explicit ledger counterparties, not hidden user wallets.
create table if not exists public.wallet_system_accounts (
  code text primary key check (code in ('welcome_pool','platform_treasury','development_vault')),
  display_name text not null,
  asset_code text not null references public.wallet_assets(code),
  balance_atomic numeric(38,0) not null default 0 check (balance_atomic >= 0),
  created_at timestamptz not null default now()
);
insert into public.wallet_system_accounts(code,display_name,asset_code,balance_atomic)
values
 ('welcome_pool','Welcome grant pool','MYGRAM_COIN',15000000000),
 ('platform_treasury','Platform liquidity treasury','MYGRAM_COIN',0),
 ('development_vault','Development infrastructure vault','MYGRAM_COIN',0)
on conflict (code) do nothing;
revoke all on public.wallet_system_accounts from public, anon, authenticated;

-- Allow a ledger entry to point to exactly one customer wallet OR one system account.
alter table public.wallet_ledger alter column wallet_id drop not null;
alter table public.wallet_ledger add column if not exists system_account_code text references public.wallet_system_accounts(code);
do $$
begin
  if not exists (select 1 from pg_constraint where conname='wallet_ledger_exactly_one_account') then
    alter table public.wallet_ledger add constraint wallet_ledger_exactly_one_account
      check ((wallet_id is not null and system_account_code is null) or
             (wallet_id is null and system_account_code is not null));
  end if;
end $$;
create unique index if not exists wallet_ledger_system_account_entry_unique
  on public.wallet_ledger(transaction_id,system_account_code,entry_kind)
  where system_account_code is not null;

create table if not exists public.wallet_grant_control (
  grant_name text primary key check (grant_name='signup_welcome'),
  grant_amount numeric(38,0) not null check (grant_amount=3000),
  max_recipients bigint not null check (max_recipients=5000000),
  granted_count bigint not null default 0 check (granted_count between 0 and max_recipients),
  pool_account_code text not null default 'welcome_pool' references public.wallet_system_accounts(code),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.wallet_grant_control(grant_name,grant_amount,max_recipients,granted_count,enabled)
values ('signup_welcome',3000,5000000,0,true)
on conflict (grant_name) do nothing;
revoke all on public.wallet_grant_control from public, anon, authenticated;

-- One record per auth user, including denied-after-cap outcomes, prevents retries from
-- re-counting a signup or granting twice.
create table if not exists public.wallet_signup_grants (
  user_id uuid primary key references auth.users(id) on delete restrict,
  granted boolean not null,
  transaction_id uuid unique references public.wallet_transactions(id) on delete restrict,
  created_at timestamptz not null default now(),
  check ((granted and transaction_id is not null) or (not granted and transaction_id is null))
);
alter table public.wallet_signup_grants enable row level security;
revoke all on public.wallet_signup_grants from public, anon, authenticated;

create or replace function wallet_private.grant_signup_welcome()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, wallet_private
as $$
declare
  v_control public.wallet_grant_control%rowtype;
  v_wallet public.wallets%rowtype;
  v_tx uuid;
begin
  -- Serialize cap checks and counter increments across concurrent signups.
  select * into v_control from public.wallet_grant_control
   where grant_name='signup_welcome' for update;
  if not found then raise exception 'welcome grant control missing'; end if;

  insert into public.wallets(user_id,asset_code,balance_atomic)
  values (new.id,'MYGRAM_COIN',0)
  on conflict (user_id,asset_code) do nothing;

  if exists(select 1 from public.wallet_signup_grants where user_id=new.id) then
    return new;
  end if;

  if not v_control.enabled or v_control.granted_count >= v_control.max_recipients then
    insert into public.wallet_signup_grants(user_id,granted) values(new.id,false)
    on conflict (user_id) do nothing;
    return new;
  end if;

  select * into v_wallet from public.wallets where user_id=new.id and asset_code='MYGRAM_COIN' for update;
  if not found then raise exception 'welcome wallet missing'; end if;

  update public.wallet_system_accounts
     set balance_atomic=balance_atomic-v_control.grant_amount
   where code=v_control.pool_account_code and asset_code='MYGRAM_COIN'
     and balance_atomic >= v_control.grant_amount;
  if not found then raise exception 'welcome pool exhausted'; end if;

  insert into public.wallet_transactions(idempotency_key,transaction_type,status,initiated_by,reference)
  values ('signup-welcome:'||new.id::text,'grant','pending',new.id,'first 5000000 signup cap')
  returning id into v_tx;

  insert into public.wallet_ledger(transaction_id,system_account_code,entry_kind,amount_atomic,asset_code)
  values(v_tx,v_control.pool_account_code,'debit',v_control.grant_amount,'MYGRAM_COIN');
  insert into public.wallet_ledger(transaction_id,wallet_id,entry_kind,amount_atomic,asset_code)
  values(v_tx,v_wallet.id,'credit',v_control.grant_amount,'MYGRAM_COIN');

  update public.wallets set balance_atomic=balance_atomic+v_control.grant_amount,
    version=version+1,updated_at=now() where id=v_wallet.id;
  update public.wallet_transactions set status='posted',posted_at=now() where id=v_tx;
  insert into public.wallet_signup_grants(user_id,granted,transaction_id) values(new.id,true,v_tx);
  update public.wallet_grant_control set granted_count=granted_count+1,updated_at=now()
   where grant_name='signup_welcome';
  return new;
end;
$$;
revoke all on function wallet_private.grant_signup_welcome() from public, anon, authenticated;
drop trigger if exists mygram_signup_welcome_grant on auth.users;
create trigger mygram_signup_welcome_grant
after insert on auth.users
for each row execute function wallet_private.grant_signup_welcome();

-- The catalog is deliberately not globally activated: service prices are unset.
-- Each service must be explicitly priced and enabled by an operator on staging.
create or replace function wallet_private.purchase_wallet_service(
  p_service_code text,
  p_idempotency_key text
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, wallet_private
as $$
declare
  v_user uuid := auth.uid();
  v_service public.wallet_service_catalog%rowtype;
  v_wallet public.wallets%rowtype;
  v_tx uuid;
  v_existing public.wallet_transactions%rowtype;
  v_treasury numeric(38,0);
  v_dev numeric(38,0);
  v_key text;
begin
  if v_user is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key))<16 or length(p_idempotency_key)>200 then
    raise exception 'valid idempotency key required' using errcode='22023';
  end if;
  v_key := 'service:'||v_user::text||':'||p_idempotency_key;
  perform pg_advisory_xact_lock(hashtextextended(v_key,0));
  select * into v_existing from public.wallet_transactions where idempotency_key=v_key;
  if found then
    if v_existing.initiated_by is distinct from v_user
       or v_existing.transaction_type <> 'purchase'
       or v_existing.status <> 'posted' then
      raise exception 'idempotency key conflict' using errcode='23505';
    end if;
    return v_existing.id;
  end if;

  select * into v_service from public.wallet_service_catalog
   where service_code=p_service_code and enabled=true for share;
  if not found then raise exception 'service unavailable' using errcode='22023'; end if;
  if v_service.price_asset_code is null or v_service.price_atomic is null or v_service.price_atomic<=0 then
    raise exception 'service has no approved price' using errcode='22023';
  end if;
  if v_service.burn_basis_points<>1000 then raise exception 'service split must be 90/10' using errcode='23514'; end if;

  insert into public.wallets(user_id,asset_code) values(v_user,v_service.price_asset_code)
  on conflict(user_id,asset_code) do nothing;
  select * into v_wallet from public.wallets where user_id=v_user and asset_code=v_service.price_asset_code for update;
  if not found then raise exception 'wallet not found'; end if;
  if v_wallet.balance_atomic<v_service.price_atomic then raise exception 'insufficient balance' using errcode='22003'; end if;

  v_dev := floor(v_service.price_atomic*0.10);
  v_treasury := v_service.price_atomic-v_dev;
  if v_dev<=0 or v_treasury<=0 then raise exception 'price too small for 90/10 split' using errcode='22023'; end if;

  insert into public.wallet_transactions(idempotency_key,transaction_type,status,initiated_by,reference,metadata)
  values(v_key,'purchase','pending',v_user,p_service_code,
    jsonb_build_object('service_code',p_service_code,'price_atomic',v_service.price_atomic,
      'treasury_atomic',v_treasury,'development_vault_atomic',v_dev,'requires_confirmation',v_service.requires_confirmation))
  returning id into v_tx;

  insert into public.wallet_ledger(transaction_id,wallet_id,entry_kind,amount_atomic,asset_code)
  values(v_tx,v_wallet.id,'debit',v_service.price_atomic,v_service.price_asset_code);
  insert into public.wallet_ledger(transaction_id,system_account_code,entry_kind,amount_atomic,asset_code)
  values(v_tx,'platform_treasury','credit',v_treasury,v_service.price_asset_code),
        (v_tx,'development_vault','credit',v_dev,v_service.price_asset_code);

  update public.wallets set balance_atomic=balance_atomic-v_service.price_atomic,
    version=version+1,updated_at=now() where id=v_wallet.id and balance_atomic>=v_service.price_atomic;
  if not found then raise exception 'balance changed; retry' using errcode='40001'; end if;
  update public.wallet_system_accounts set balance_atomic=balance_atomic+v_treasury
   where code='platform_treasury' and asset_code=v_service.price_asset_code;
  if not found then raise exception 'treasury asset mismatch'; end if;
  update public.wallet_system_accounts set balance_atomic=balance_atomic+v_dev
   where code='development_vault' and asset_code=v_service.price_asset_code;
  if not found then raise exception 'development vault asset mismatch'; end if;

  update public.wallet_transactions set status='posted',posted_at=now() where id=v_tx;
  return v_tx;
end;
$$;

revoke all on function wallet_private.purchase_wallet_service(text,text) from public, anon, authenticated;
create or replace function public.purchase_wallet_service(p_service_code text,p_idempotency_key text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, wallet_private
as $$
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  return wallet_private.purchase_wallet_service(p_service_code,p_idempotency_key);
end;
$$;
revoke all on function public.purchase_wallet_service(text,text) from public, anon;
grant execute on function public.purchase_wallet_service(text,text) to authenticated;
commit;
