-- Runs only against the disposable GitHub Actions PostgreSQL service.
-- These are integration/invariant tests, not a substitute for full Supabase Auth tests.
\set ON_ERROR_STOP on
begin;

-- Make the asset usable only in this ephemeral test database.
update public.wallet_assets set enabled=true where code='MYGRAM_COIN';

-- Signup trigger grants exactly 3,000 once and writes balanced ledger entries.
insert into auth.users(id,email) values
 ('10000000-0000-4000-8000-000000000001','wallet-a@example.invalid'),
 ('10000000-0000-4000-8000-000000000002','wallet-b@example.invalid'),
 ('10000000-0000-4000-8000-000000000003','wallet-c@example.invalid');

do $$
begin
  if (select balance_atomic from public.wallets where user_id='10000000-0000-4000-8000-000000000001' and asset_code='MYGRAM_COIN') <> 3000 then
    raise exception 'FAIL: signup grant amount is not 3000';
  end if;
  if (select granted_count from public.wallet_grant_control where grant_name='signup_welcome') <> 3 then
    raise exception 'FAIL: signup grant counter should be 3';
  end if;
  if (select count(*) from public.wallet_signup_grants where granted) <> 3 then
    raise exception 'FAIL: expected 3 granted signup records';
  end if;
  if exists (
    select transaction_id
    from public.wallet_ledger
    group by transaction_id
    having sum(case when entry_kind='debit' then amount_atomic else -amount_atomic end) <> 0
  ) then
    raise exception 'FAIL: unbalanced signup ledger transaction';
  end if;
end $$;

-- Simulate reaching the cap; next signup must be recorded as denied, not credited.
update public.wallet_grant_control set granted_count=5000000 where grant_name='signup_welcome';
insert into auth.users(id,email) values
 ('10000000-0000-4000-8000-000000000004','wallet-cap@example.invalid');
do $$
begin
  if (select balance_atomic from public.wallets where user_id='10000000-0000-4000-8000-000000000004' and asset_code='MYGRAM_COIN') <> 0 then
    raise exception 'FAIL: grant continued after cap';
  end if;
  if (select granted from public.wallet_signup_grants where user_id='10000000-0000-4000-8000-000000000004') is distinct from false then
    raise exception 'FAIL: cap denial not recorded';
  end if;
end $$;

-- Restore counter for transfer/purchase tests; the cap simulation is not a real 5M-user load test.
update public.wallet_grant_control set granted_count=3 where grant_name='signup_welcome';

-- Transfer: seed sender balance through trusted test setup, then call the public RPC as user A.
update public.wallets set balance_atomic=10000
 where user_id='10000000-0000-4000-8000-000000000001' and asset_code='MYGRAM_COIN';
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select public.post_wallet_transfer(
 'test-transfer-idempotency-0001',
 '10000000-0000-4000-8000-000000000002',
 'MYGRAM_COIN', 1200, 'staging-smoke'
);
-- Same idempotency key must return existing transaction and not double-post.
select public.post_wallet_transfer(
 'test-transfer-idempotency-0001',
 '10000000-0000-4000-8000-000000000002',
 'MYGRAM_COIN', 1200, 'staging-smoke'
);
do $$
begin
  if (select balance_atomic from public.wallets where user_id='10000000-0000-4000-8000-000000000001' and asset_code='MYGRAM_COIN') <> 8800 then
    raise exception 'FAIL: sender balance wrong or idempotent retry double-debited';
  end if;
  if (select balance_atomic from public.wallets where user_id='10000000-0000-4000-8000-000000000002' and asset_code='MYGRAM_COIN') <> 4200 then
    raise exception 'FAIL: recipient balance wrong or idempotent retry double-credited';
  end if;
end $$;

-- Enable one service only in this test DB with a controlled 1,000-unit price.
update public.wallet_service_catalog
set enabled=true, price_asset_code='MYGRAM_COIN', price_atomic=1000, burn_basis_points=1000
where service_code=(select service_code from public.wallet_service_catalog order by service_code limit 1);
select public.purchase_wallet_service(
 (select service_code from public.wallet_service_catalog order by service_code limit 1),
 'test-purchase-idempotency-0001'
);
do $$
begin
  if (select balance_atomic from public.wallets where user_id='10000000-0000-4000-8000-000000000001' and asset_code='MYGRAM_COIN') <> 7800 then
    raise exception 'FAIL: service purchase debit incorrect';
  end if;
  if (select balance_atomic from public.wallet_system_accounts where code='platform_treasury') <> 900 then
    raise exception 'FAIL: 90 percent treasury split incorrect';
  end if;
  if (select balance_atomic from public.wallet_system_accounts where code='development_vault') <> 100 then
    raise exception 'FAIL: 10 percent development split incorrect';
  end if;
end $$;

rollback;
select 'PASS: signup grant, cap stop, balanced ledger, transfer idempotency, 90/10 settlement' as test_result;
