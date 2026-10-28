-- DRAFT ONLY. Depends on 20261029000000_draft_wallets_ledger_and_import_schema.sql.
-- This migration is not production-ready until reviewed and tested against a disposable Supabase project.
begin;

-- Guard ledger writes: only the posting function below may insert entries.
revoke insert, update, delete on public.wallet_ledger from anon, authenticated;
revoke insert, update, delete on public.wallet_transactions from anon, authenticated;
revoke insert, update, delete on public.wallets from anon, authenticated;

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
  v_debits numeric(38,0);
  v_credits numeric(38,0);
begin
  if v_sender is null then
    raise exception 'authentication required' using errcode='28000';
  end if;
  if p_recipient_user_id is null or p_recipient_user_id = v_sender then
    raise exception 'recipient must be another user' using errcode='22023';
  end if;
  if p_amount_atomic is null or p_amount_atomic <= 0 or scale(p_amount_atomic) <> 0 then
    raise exception 'amount must be a positive integer in atomic units' using errcode='22023';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 16 or length(p_idempotency_key) > 200 then
    raise exception 'valid idempotency key required' using errcode='22023';
  end if;
  if not exists (select 1 from public.wallet_assets a where a.code=p_asset_code and a.enabled=true) then
    raise exception 'asset is not enabled' using errcode='22023';
  end if;

  -- Serialize by locking both wallet rows in deterministic ID order.
  select * into v_sender_wallet from public.wallets
   where user_id=v_sender and asset_code=p_asset_code for update;
  if not found then raise exception 'sender wallet not found' using errcode='P0002'; end if;

  insert into public.wallets(user_id,asset_code)
  values (p_recipient_user_id,p_asset_code)
  on conflict (user_id,asset_code) do nothing;

  select * into v_recipient_wallet from public.wallets
   where user_id=p_recipient_user_id and asset_code=p_asset_code for update;
  if not found then raise exception 'recipient wallet not found' using errcode='P0002'; end if;

  -- Idempotency is scoped to this caller; replaying the same key cannot post a second transfer.
  select * into v_existing from public.wallet_transactions
   where idempotency_key = v_sender::text || ':' || p_idempotency_key;
  if found then
    if v_existing.initiated_by <> v_sender then
      raise exception 'idempotency key conflict' using errcode='23505';
    end if;
    return v_existing.id;
  end if;

  -- Lock order above is not guaranteed if recipient wallet existed with a lower ID.
  -- The transaction-level advisory lock serializes this idempotency key.
  perform pg_advisory_xact_lock(hashtextextended(v_sender::text || ':' || p_idempotency_key, 0));

  -- Recheck after advisory lock to close concurrent replay race.
  select * into v_existing from public.wallet_transactions
   where idempotency_key = v_sender::text || ':' || p_idempotency_key;
  if found then return v_existing.id; end if;

  if v_sender_wallet.balance_atomic < p_amount_atomic then
    raise exception 'insufficient balance' using errcode='22003';
  end if;

  insert into public.wallet_transactions(idempotency_key,transaction_type,status,initiated_by,reference)
  values (v_sender::text || ':' || p_idempotency_key,'transfer','pending',v_sender,p_reference)
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

revoke all on function wallet_private.post_wallet_transfer(text,uuid,text,numeric,text) from public, anon;
grant usage on schema wallet_private to authenticated;
grant execute on function wallet_private.post_wallet_transfer(text,uuid,text,numeric,text) to authenticated;

-- Deliberately no function is provided to move founder reserve funds.
-- A Supabase service-role key is not a founder-owned signing key. Founder reserve movement
-- requires a separate cryptographic approval design, independent signer verification,
-- hardware-backed private key custody and a tested emergency/recovery policy.

commit;
