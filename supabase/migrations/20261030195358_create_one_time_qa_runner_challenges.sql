BEGIN;

CREATE TABLE public.qa_run_challenges (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qa_run_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_run_challenges FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.qa_run_challenges FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.qa_run_challenges TO service_role;

COMMENT ON TABLE public.qa_run_challenges IS
  'One-time, short-lived challenge hashes for protected Staging QA Edge Function runs. No API client role can access this table.';

COMMIT;
