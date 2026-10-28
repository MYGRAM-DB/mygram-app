-- DRAFT ONLY. Public RPC entry point; private implementation remains unexposed.
begin;
revoke usage on schema wallet_private from public, anon, authenticated;
revoke all on function wallet_private.post_wallet_transfer(text,uuid,text,numeric,text) from public, anon, authenticated;

create or replace function public.post_wallet_transfer(
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
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode='28000';
  end if;
  return wallet_private.post_wallet_transfer(
    p_idempotency_key, p_recipient_user_id, p_asset_code, p_amount_atomic, p_reference
  );
end;
$$;

revoke all on function public.post_wallet_transfer(text,uuid,text,numeric,text) from public, anon;
grant execute on function public.post_wallet_transfer(text,uuid,text,numeric,text) to authenticated;
commit;
