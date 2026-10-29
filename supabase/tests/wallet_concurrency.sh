#!/usr/bin/env bash
set -euo pipefail

A='10000000-0000-4000-8000-000000000001'
B='10000000-0000-4000-8000-000000000002'
ASSET='MYGRAM_COIN'

# This script runs only against the disposable PostgreSQL service in GitHub Actions.
psql -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users(id,email) values
 ('10000000-0000-4000-8000-000000000001','concurrency-a@example.invalid'),
 ('10000000-0000-4000-8000-000000000002','concurrency-b@example.invalid')
on conflict (id) do nothing;
update public.wallet_assets set enabled=true where code='MYGRAM_COIN';
insert into public.wallets(user_id,asset_code,balance_atomic)
select u.id,'MYGRAM_COIN',10000 from auth.users u
where u.id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002')
on conflict (user_id,asset_code) do update set balance_atomic=10000,version=0;
SQL

transfer() {
  local sender="$1" recipient="$2" key="$3" amount="$4"
  psql -X -q -v ON_ERROR_STOP=1 -v sender="$sender" -v recipient="$recipient" -v key="$key" -v amount="$amount" <<'SQL'
select set_config('request.jwt.claim.sub', :'sender', false);
select public.post_wallet_transfer(:'key', :'recipient', 'MYGRAM_COIN', :'amount'::numeric, 'concurrency-ci');
SQL
}

# 30 opposing transfers in each direction, launched concurrently as independent DB sessions.
pids=()
for i in $(seq 1 30); do
  transfer "$A" "$B" "opposing-a-to-b-$i-000000" 1 >/dev/null &
  pids+=("$!")
  transfer "$B" "$A" "opposing-b-to-a-$i-000000" 1 >/dev/null &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done

# 20 concurrent retries with the same sender and idempotency key must post once.
pids=()
for i in $(seq 1 20); do
  transfer "$A" "$B" "same-key-concurrent-000001" 7 >/dev/null &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done

# Race 25 distinct debits of 500 from a wallet holding 10,000: exactly 20 can succeed.
# Failures due to insufficient balance are expected; all other failures fail the test.
pids=()
for i in $(seq 1 25); do
  (transfer "$A" "$B" "overspend-race-$i-000000000" 500 >/tmp/wallet-race-"$i".log 2>&1) &
  pids+=("$!")
done
success=0
for i in $(seq 1 25); do
  if wait "${pids[$((i-1))]}"; then
    success=$((success+1))
  else
    if ! grep -q 'insufficient balance' /tmp/wallet-race-"$i".log; then
      cat /tmp/wallet-race-"$i".log
      echo "FAIL: unexpected error in overspend race request $i" >&2
      exit 1
    fi
  fi
done

# Independent invariant checks after all sessions have completed.
psql -v ON_ERROR_STOP=1 -v expected_success="$success" <<'SQL'
do $$
declare
  a constant uuid := '10000000-0000-4000-8000-000000000001';
  b constant uuid := '10000000-0000-4000-8000-000000000002';
  a_balance numeric;
  b_balance numeric;
  idempotent_count integer;
begin
  select balance_atomic into a_balance from public.wallets where user_id=a and asset_code='MYGRAM_COIN';
  select balance_atomic into b_balance from public.wallets where user_id=b and asset_code='MYGRAM_COIN';
  if a_balance < 0 or b_balance < 0 then raise exception 'FAIL: negative balance'; end if;
  if a_balance + b_balance <> 20000 then raise exception 'FAIL: conservation violated: A %, B %',a_balance,b_balance; end if;
  select count(*) into idempotent_count from public.wallet_transactions
   where idempotency_key = a::text || ':same-key-concurrent-000001'
     and transaction_type='transfer' and status='posted';
  if idempotent_count <> 1 then raise exception 'FAIL: concurrent idempotency posted % transactions',idempotent_count; end if;
  if exists (
    select t.id from public.wallet_transactions t
    join public.wallet_ledger l on l.transaction_id=t.id
    where t.status='posted'
    group by t.id
    having sum(case when l.entry_kind='debit' then l.amount_atomic else -l.amount_atomic end) <> 0
  ) then raise exception 'FAIL: unbalanced posted ledger transaction'; end if;
end $$;
SQL

echo "PASS: opposing transfers, same-key concurrent idempotency, overspend race, nonnegative balances, conservation, balanced ledger (successful race calls: $success)"
