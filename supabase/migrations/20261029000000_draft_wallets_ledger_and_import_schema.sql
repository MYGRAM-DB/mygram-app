-- DRAFT ONLY: review before applying to production.
-- Monetary values are integer atomic units. No floating-point arithmetic.
begin;

create schema if not exists wallet_private;
revoke all on schema wallet_private from public, anon, authenticated;

create table if not exists public.wallet_assets (
  code text primary key check (code in ('MYGRAM_COIN','DINGRAM','DIRGRAM')),
  display_name text not null,
  smallest_unit_name text not null,
  decimals smallint not null default 0 check (decimals = 0),
  parent_code text references public.wallet_assets(code),
  units_per_parent numeric(38,0),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  check (
    (parent_code is null and units_per_parent is null)
    or (parent_code is not null and units_per_parent is not null and units_per_parent > 0)
  )
);

insert into public.wallet_assets(code,display_name,smallest_unit_name,parent_code,units_per_parent,enabled)
values
 ('MYGRAM_COIN','MYGRAM COIN','atomic unit',null,null,false),
 ('DINGRAM','DinGram','DirGram', 'MYGRAM_COIN', null, false),
 ('DIRGRAM','DirGram','atomic unit', 'DINGRAM', null, false)
on conflict (code) do nothing;
-- Conversion ratios intentionally remain NULL until product/legal owners specify them.

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  asset_code text not null references public.wallet_assets(code),
  balance_atomic numeric(38,0) not null default 0 check (balance_atomic >= 0),
  version bigint not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, asset_code)
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  transaction_type text not null check (transaction_type in
    ('grant','purchase','subscription','transfer','refund','reversal','adjustment','migration')),
  status text not null default 'pending' check (status in ('pending','posted','failed','reversed')),
  initiated_by uuid references auth.users(id) on delete restrict,
  reference text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

create table if not exists public.wallet_ledger (
  id bigint generated always as identity primary key,
  transaction_id uuid not null references public.wallet_transactions(id) on delete restrict,
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  entry_kind text not null check (entry_kind in ('debit','credit')),
  amount_atomic numeric(38,0) not null check (amount_atomic > 0),
  asset_code text not null references public.wallet_assets(code),
  created_at timestamptz not null default now(),
  unique(transaction_id, wallet_id, entry_kind)
);
create index if not exists wallet_ledger_wallet_created_idx
  on public.wallet_ledger(wallet_id, created_at desc);
create index if not exists wallet_transactions_created_idx
  on public.wallet_transactions(created_at desc);

-- Treasury and founder reserve are segregated in a non-API schema.
-- Do not add these wallets to public.wallets or expose this schema via PostgREST.
create table if not exists wallet_private.allocation_accounts (
  allocation_key text primary key check (allocation_key in
    ('market_circulating','platform_treasury','founder_core_reserve')),
  asset_code text not null references public.wallet_assets(code),
  allocated_atomic numeric(38,0) not null check (allocated_atomic >= 0),
  locked boolean not null default true,
  vesting_terms jsonb not null default '{}'::jsonb check (jsonb_typeof(vesting_terms) = 'object'),
  created_at timestamptz not null default now()
);

insert into wallet_private.allocation_accounts
(allocation_key,asset_code,allocated_atomic,locked,vesting_terms)
values
 ('market_circulating','MYGRAM_COIN',15000000000,false,'{}'::jsonb),
 ('platform_treasury','MYGRAM_COIN',15000000000,true,'{"status":"proposed","requires_approval":true}'::jsonb),
 ('founder_core_reserve','MYGRAM_COIN',20000000000,true,'{"status":"proposed","requires_legal_review":true,"schedule":"not_set"}'::jsonb)
on conflict (allocation_key) do nothing;

create table if not exists public.migration_import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  provider text not null check (provider in ('meta_export','facebook','instagram','contacts','other')),
  status text not null default 'created' check (status in
    ('created','awaiting_upload','queued','processing','needs_review','completed','failed','cancelled')),
  consented_at timestamptz,
  consent_version text,
  source_file_name text,
  source_file_sha256 text,
  items_seen integer not null default 0 check (items_seen >= 0),
  items_imported integer not null default 0 check (items_imported >= 0),
  error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (items_imported <= items_seen)
);

create table if not exists public.migration_import_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.migration_import_jobs(id) on delete cascade,
  item_type text not null check (item_type in ('profile','connection','post_reference','media_reference','contact_match')),
  source_external_id text,
  target_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','matched','imported','skipped','needs_consent','failed')),
  minimal_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(minimal_payload) = 'object'),
  created_at timestamptz not null default now(),
  unique(job_id,item_type,source_external_id)
);

alter table public.wallet_assets enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.wallet_ledger enable row level security;
alter table public.migration_import_jobs enable row level security;
alter table public.migration_import_items enable row level security;

drop policy if exists wallet_assets_read_enabled on public.wallet_assets;
create policy wallet_assets_read_enabled on public.wallet_assets
for select to authenticated using (enabled = true);

drop policy if exists wallets_select_own on public.wallets;
create policy wallets_select_own on public.wallets
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists wallet_transactions_select_own on public.wallet_transactions;
create policy wallet_transactions_select_own on public.wallet_transactions
for select to authenticated using (
  exists (select 1 from public.wallet_ledger l join public.wallets w on w.id=l.wallet_id
          where l.transaction_id=wallet_transactions.id and w.user_id=(select auth.uid()))
);

drop policy if exists wallet_ledger_select_own on public.wallet_ledger;
create policy wallet_ledger_select_own on public.wallet_ledger
for select to authenticated using (
  exists (select 1 from public.wallets w where w.id=wallet_ledger.wallet_id and w.user_id=(select auth.uid()))
);

drop policy if exists migration_jobs_select_own on public.migration_import_jobs;
create policy migration_jobs_select_own on public.migration_import_jobs
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists migration_items_select_own on public.migration_import_items;
create policy migration_items_select_own on public.migration_import_items
for select to authenticated using (
  exists (select 1 from public.migration_import_jobs j
          where j.id=migration_import_items.job_id and j.user_id=(select auth.uid()))
);

-- No client INSERT/UPDATE/DELETE policies for wallets, ledger, transaction posting, imports or private allocation.
-- Server-side posting/import RPCs are intentionally a separate reviewed step.
revoke insert, update, delete on public.wallet_assets, public.wallets, public.wallet_transactions,
  public.wallet_ledger, public.migration_import_jobs, public.migration_import_items
from anon, authenticated;
revoke all on wallet_private.allocation_accounts from public, anon, authenticated;

commit;
