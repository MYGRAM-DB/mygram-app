#!/usr/bin/env python3
"""Disposable-PostgreSQL/PostgREST integration and load test. Never targets hosted Supabase."""
import concurrent.futures
import hashlib
import hmac
import json
import os
import statistics
import time
import urllib.error
import urllib.request
import base64

API = os.environ.get("API_URL", "http://localhost:3000").rstrip("/")
SECRET = os.environ["JWT_SECRET"]
SENDER = "10000000-0000-4000-8000-000000000001"
RECIPIENT = "10000000-0000-4000-8000-000000000002"
ASSET = "MYGRAM_COIN"


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def jwt_for(user_id: str) -> str:
    now = int(time.time())
    header = b64url(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = b64url(json.dumps({
        "role": "authenticated", "sub": user_id, "aud": "authenticated",
        "iat": now, "exp": now + 3600,
    }, separators=(",", ":")).encode())
    signing_input = f"{header}.{payload}".encode()
    signature = hmac.new(SECRET.encode(), signing_input, hashlib.sha256).digest()
    return f"{header}.{payload}.{b64url(signature)}"


TOKEN = jwt_for(SENDER)


def call(payload, timeout=30):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{API}/rpc/post_wallet_transfer",
        data=data,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            body = response.read().decode()
            return response.status, body, time.perf_counter() - started
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode(), time.perf_counter() - started


def payload(key, amount=1, reference="api-load-test"):
    return {
        "p_idempotency_key": key,
        "p_recipient_user_id": RECIPIENT,
        "p_asset_code": ASSET,
        "p_amount_atomic": amount,
        "p_reference": reference,
    }


def require(condition, message):
    if not condition:
        raise SystemExit(f"FAIL: {message}")


def main():
    # Seed accounts and a controlled balance only in the disposable CI database.
    # User inserts may fire the welcome-grant trigger, so balances are reset afterwards.
    import subprocess
    sql = f"""
    insert into auth.users(id,email) values
      ('{SENDER}','api-load-a@example.invalid'),
      ('{RECIPIENT}','api-load-b@example.invalid')
    on conflict(id) do nothing;
    update public.wallet_assets set enabled=true where code='{ASSET}';
    update public.wallets set balance_atomic=10000,version=0
      where user_id='{SENDER}' and asset_code='{ASSET}';
    update public.wallets set balance_atomic=0,version=0
      where user_id='{RECIPIENT}' and asset_code='{ASSET}';
    """
    subprocess.run(["psql", "-v", "ON_ERROR_STOP=1", "-c", sql], check=True)

    # Verify the actual HTTP status mapping, not merely the SQLSTATE in psql.
    status, body, _ = call(payload("http-idempotency-conflict-0001", 10, "api-conflict-test"))
    require(status == 200, f"baseline RPC failed: HTTP {status}: {body}")
    status, body, _ = call(payload("http-idempotency-conflict-0001", 11, "api-conflict-test"))
    require(status == 409, f"expected HTTP 409 for changed amount, got HTTP {status}: {body}")
    require("23505" in body or "idempotency key conflict" in body.lower(),
            f"HTTP 409 body did not identify idempotency conflict: {body}")
    print("PASS: PostgREST maps idempotency payload mismatch to HTTP 409")

    for total in (500, 1000):
        # Reset controlled test balances between phases; never calls a hosted endpoint.
        sql = f"""
        update public.wallets set balance_atomic=10000,version=0
          where user_id='{SENDER}' and asset_code='{ASSET}';
        update public.wallets set balance_atomic=0,version=0
          where user_id='{RECIPIENT}' and asset_code='{ASSET}';
        """
        subprocess.run(["psql", "-v", "ON_ERROR_STOP=1", "-c", sql], check=True)

        started = time.perf_counter()
        results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=total) as pool:
            futures = [
                pool.submit(call, payload(f"load-{total}-{i:05d}-unique-key", 1, "api-load-test"))
                for i in range(total)
            ]
            for future in concurrent.futures.as_completed(futures):
                results.append(future.result())
        elapsed = time.perf_counter() - started
        statuses = [status for status, _, _ in results]
        latencies = sorted(latency for _, _, latency in results)
        failures = [(status, body[:300]) for status, body, _ in results if status != 200]
        require(not failures, f"{total}-request load had {len(failures)} HTTP failures; sample={failures[:3]}")
        p50 = statistics.median(latencies)
        p95 = latencies[min(len(latencies) - 1, int(len(latencies) * 0.95))]
        print(
            f"PASS: {total} concurrent HTTP RPC requests; success={len(statuses)}, "
            f"failed=0, elapsed={elapsed:.2f}s, throughput={total/elapsed:.1f} req/s, "
            f"latency_p50={p50*1000:.1f}ms, latency_p95={p95*1000:.1f}ms"
        )

    print("PASS: API conflict and 500/1000-request load suite completed on disposable CI only")


if __name__ == "__main__":
    main()
