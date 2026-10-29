-- STAGING DRAFT ONLY. Requires the wallet base schema and public RPC wrapper.
-- Never apply to production until staging tests and independent review pass.
begin;

create or replace function wallet_private.post_wallet_transfer(
  p_idempotency_key text,
  p_recipient_user_id uuid,
  p_asset_code text,
  p_amount_atomic numeric,
  p_reference text default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, wallet_private
as $$
declare
  v_sender uuid := auth.uid();
  v_sender_wallet public.wallets%rowtype;
  v_recipient_wallet public.wallets%rowtype;
  v_tx_id uuid;
  v_existing public.wallet_transactions%rowtype;
  v_key text;
  v_debits numeric(38,0);
  v_credits numeric(38,0);
begin
  if v_sender is null then
    raise exception 'authentication required' using errcode='28000';
  end if;
  if p_recipient_user_id is null or p_recipient_user_id = v_sender then
    raise exception 'recipient must be another user' using errcode='22023';
  end if;
  if p_amount_atomic is null or p_amount_atomic <= 0 or scale(p_amount_atomic) <> 0
     or p_amount_atomic > 99999999999999999999999999999999999999 then
    raise exception 'amount must be a positive integer in atomic units' using errcode='22023';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 16 or length(p_idempotency_key) > 200 then
    raise exception 'valid idempotency key required' using errcode='22023';
  end if;
  if p_asset_code is null or not exists (
    select 1 from public.wallet_assets a where a.code=p_asset_code and a.enabled=true
  ) then
    raise exception 'asset is not enabled' using errcode='22023';
  end if;

  v_key := v_sender::text || ':' || p_idempotency_key;

  -- Serialize identical retries before checking or creating any posting records.
  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));
  select * into v_existing from public.wallet_transactions where idempotency_key=v_key;
  if found then
    -- A key is bound to the complete original request, not merely its owner/type.
    -- SQLSTATE 23505 maps to HTTP 409 Conflict through PostgREST.
    if v_existing.initiated_by is distinct from v_sender
       or v_existing.transaction_type <> 'transfer'
       or v_existing.status <> 'posted'
       or v_existing.reference is distinct from p_reference
       or not exists (
         select 1
           from public.wallet_ledger debit
           join public.wallets sender_wallet on sender_wallet.id=debit.wallet_id
          where debit.transaction_id=v_existing.id
            and debit.entry_kind='debit'
            and debit.asset_code=p_asset_code
            and debit.amount_atomic=p_amount_atomic
            and sender_wallet.user_id=v_sender
       )
       or not exists (
         select 1
           from public.wallet_ledger credit
           join public.wallets recipient_wallet on recipient_wallet.id=credit.wallet_id
          where credit.transaction_id=v_existing.id
            and credit.entry_kind='credit'
            and credit.asset_code=p_asset_code
            and credit.amount_atomic=p_amount_atomic
            and recipient_wallet.user_id=p_recipient_user_id
       )
       or (select count(*) from public.wallet_ledger l
            where l.transaction_id=v_existing.id and l.asset_code=p_asset_code) <> 2
       or exists (select 1 from public.wallet_ledger l
                   where l.transaction_id=v_existing.id and l.asset_code<>p_asset_code) then
      raise exception 'idempotency key conflict: request payload differs from original' using errcode='23505';
    end if;
    return v_existing.id;
  end if;

  -- Create recipient wallet if needed; unique(user_id, asset_code) handles races.
  insert into public.wallets(user_id,asset_code)
  values (p_recipient_user_id,p_asset_code)
  on conflict (user_id,asset_code) do nothing;

  -- Lock BOTH rows in one globally deterministic order. Never lock sender first.
  perform w.id
    from public.wallets w
   where w.asset_code=p_asset_code
     and w.user_id in (v_sender,p_recipient_user_id)
   order by w.id
   for update;

  select * into v_sender_wallet from public.wallets
   where user_id=v_sender and asset_code=p_asset_code;
  if not found then raise exception 'sender wallet not found' using errcode='P0002'; end if;

  select * into v_recipient_wallet from public.wallets
   where user_id=p_recipient_user_id and asset_code=p_asset_code;
  if not found then raise exception 'recipient wallet not found' using errcode='P0002'; end if;

  if v_sender_wallet.balance_atomic < p_amount_atomic then
    raise exception 'insufficient balance' using errcode='22003';
  end if;

  insert into public.wallet_transactions(idempotency_key,transaction_type,status,initiated_by,reference)
  values (v_key,'transfer','pending',v_sender,p_reference)
  returning id into v_tx_id;

  insert into public.wallet_ledger(transaction_id,wallet_id,entry_kind,amount_atomic,asset_code)
  values (v_tx_id,v_sender_wallet.id,'debit',p_amount_atomic,p_asset_code),
         (v_tx_id,v_recipient_wallet.id,'credit',p_amount_atomic,p_asset_code);

  select coalesce(sum(amount_atomic) filter (where entry_kind='debit'),0),
         coalesce(sum(amount_atomic) filter (where entry_kind='credit'),0)
    into v_debits,v_credits
    from public.wallet_ledger
   where transaction_id=v_tx_id and asset_code=p_asset_code;
  if v_debits <> v_credits or v_debits <> p_amount_atomic then
    raise exception 'ledger entries are not balanced' using errcode='23514';
  end if;

  update public.wallets
     set balance_atomic=balance_atomic-p_amount_atomic, version=version+1, updated_at=now()
   where id=v_sender_wallet.id and balance_atomic >= p_amount_atomic;
  if not found then raise exception 'sender balance changed; retry' using errcode='40001'; end if;

  update public.wallets
     set balance_atomic=balance_atomic+p_amount_atomic, version=version+1, updated_at=now()
   where id=v_recipient_wallet.id;

  update public.wallet_transactions set status='posted',posted_at=now() where id=v_tx_id;
  return v_tx_id;
end;
$$;

revoke all on function wallet_private.post_wallet_transfer(text,uuid,text,numeric,text) from public, anon, authenticated;
grant execute on function wallet_private.post_wallet_transfer(text,uuid,text,numeric,text) to authenticated;
commit;
