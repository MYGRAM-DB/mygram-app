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

# A retry with the exact same payload is safe; reusing the same key with altered
# amount, recipient, or asset must fail with a conflict and must not post another entry.
if transfer "$A" "$B" "same-key-concurrent-000001" 8 >/tmp/wallet-idempotency-amount.log 2>&1; then
  echo "FAIL: same key with changed amount was accepted" >&2; exit 1
fi
grep -q 'idempotency key conflict' /tmp/wallet-idempotency-amount.log || {
  cat /tmp/wallet-idempotency-amount.log; echo "FAIL: changed amount did not return idempotency conflict" >&2; exit 1;
}
if transfer "$A" "$A" "same-key-concurrent-000001" 7 >/tmp/wallet-idempotency-recipient.log 2>&1; then
  echo "FAIL: same key with changed recipient was accepted" >&2; exit 1
fi
grep -q 'idempotency key conflict' /tmp/wallet-idempotency-recipient.log || {
  cat /tmp/wallet-idempotency-recipient.log; echo "FAIL: changed recipient did not return idempotency conflict" >&2; exit 1;
}
psql -X -q -v ON_ERROR_STOP=1 <<'SQL'
update public.wallet_assets set enabled=true where code='DINGRAM';
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
SQL
if psql -X -q -v ON_ERROR_STOP=1 <<'SQL' >/tmp/wallet-idempotency-asset.log 2>&1
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select public.post_wallet_transfer('same-key-concurrent-000001',
  '10000000-0000-4000-8000-000000000002','DINGRAM',7,'concurrency-ci');
SQL
then
  echo "FAIL: same key with changed asset was accepted" >&2; exit 1
fi
grep -q 'idempotency key conflict' /tmp/wallet-idempotency-asset.log || {
  cat /tmp/wallet-idempotency-asset.log; echo "FAIL: changed asset did not return idempotency conflict" >&2; exit 1;
}
echo "PASS: idempotency payload mismatch rejected (amount, recipient, asset)"

# Reset to a controlled boundary case: A has exactly 500, B receives the conserved remainder.
# Of 25 concurrent distinct debits of 500, exactly one must succeed and 24 must be rejected.
psql -v ON_ERROR_STOP=1 <<'SQL'
update public.wallets set balance_atomic = case
  when user_id='10000000-0000-4000-8000-000000000001' then 500
  when user_id='10000000-0000-4000-8000-000000000002' then 19500
  else balance_atomic end
where asset_code='MYGRAM_COIN'
  and user_id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002');
SQL

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

if [[ "$success" -ne 1 ]]; then
  echo "FAIL: expected exactly 1 accepted debit and 24 insufficient-balance rejections; got $success accepted" >&2
  for i in $(seq 1 25); do cat /tmp/wallet-race-"$i".log; done
  exit 1
fi

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
