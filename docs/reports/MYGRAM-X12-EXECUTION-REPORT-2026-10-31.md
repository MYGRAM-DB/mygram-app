# MYGRAM X12 execution report

**Checkpoint:** 2026-10-31  
**Repository:** `MYGRAM-DB/mygram-app`  
**Integration target:** `rebuild/phase-a-architecture`  
**Scope:** source changes on isolated branches and read-only environment evidence only.

## Executive result

X12 produced two isolated source changes with exact-head CI evidence:

1. W10 made both QA Edge Function sources fail closed when replay-cache expiry cleanup fails.
2. W2 fixed the Messenger attachment-metadata failure path so failed file-only sends compensate both the uploaded object and the empty message; text-plus-file sends preserve the valid text message.

These changes passed their recorded CI jobs. Neither result constitutes Staging runtime acceptance. No user journey is accepted, Gate A remains OPEN, and Release Ready remains NO.

## Workstream evidence

| Workstream | Source / branch result | Exact-head evidence | Acceptance boundary |
|---|---|---|---|
| W10 / OIDC | PR #90 branch `feature/workshop-platform-contracts`; head `d9a8dbe667d1a2d83ab54016e0b70a4779d2c7b6`. Both QA function sources now return 503 if replay-cache expiry cleanup fails; regression test added. `workflow_sha` remains null. | [Run #41232812451](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41232812451): 19/19 Node tests, 7/7 Playwright baseline tests, Deno checks, TypeScript and build succeeded. | No QA invocation, no Edge Function deployment, no deployed-source provenance proof, no independent Security approval, no immutable workflow SHA pin. |
| Security | Read-only Supabase Advisors and catalog review on Staging and Production. No source or environment security settings changed. | Findings summarized below; raw evidence queried at 2026-10-31 19:09 UTC. | Independent review remains required for authenticated SECURITY DEFINER RPCs. Leaked-password protection remains disabled. |
| Database | Existing Draft PR #97 proposals for #93 and #95 retained. No migration file created or applied. Five previously identified migration sources remain unrecovered. | Existing X11 read-only schema evidence remains the baseline. | No SQL substitute, no migration-history rewrite, no schema change, no RLS change. |
| W1 / Facebook | PR #91 remains on `feature/workshop-fb`, head `d5a2f6c657986c51a232ef1b5826cb7b3d4265d9`. Existing feed/comment/edit source retained. | [Run #41197385536](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41197385536): 11/11 Node tests and 7/7 Playwright baseline tests passed. | No Public/Private acceptance. Staging has no post audience column and broad authenticated SELECT policies remain. Do not expose a privacy toggle. |
| W2 / Messenger | PR #92 branch `feature/workshop-messenger`; head `df916e2565b989d5d22f1f55ae16e9993ac7e382`. Added explicit attachment compensation and failure reporting. | [Run #41232728809](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41232728809): 16/16 Node tests, including three compensation tests, and 7/7 Playwright baseline tests passed; integration-source syntax and build passed. | No real upload fault injection, A/B/C runtime isolation, Realtime reconnect, signed-URL expiry/renewal, or Staging E2E was executed. |
| Android | PR #59 remains open/Draft. The generated native source archive was previously inspected as an artifact; no native source was promoted into the repository. | [Run #41185503288](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41185503288) succeeded as an ephemeral CI build. | No physical device or emulator acceptance evidence; no APK distribution. |
| CI/CD | W10 owns central `.github/workflows/ci.yml`. Its proposed integration-target trigger is present in PR #90, not yet in the integration branch. | PR #90 and #92 have exact-head CI successes. PR #97 has no exact-head run/status. | No branch-protection change, no merge, no auto-merge, and no manual dispatch. |

## Security Advisor disposition

### Staging

- `qa_run_challenges`, `ui_translation_cache`, and `ui_translation_daily_usage` are RLS-enabled with no policies. Catalog checks show owner `postgres` and table grants only to `postgres` and `service_role`; no `anon` or `authenticated` grants were found. This is consistent with service-only/default-deny access. Keep the INFO finding visible rather than adding permissive policies.
- `qa_run_challenges.token_hash` has a unique primary-key index. The W10 source now fails closed if expired-row cleanup fails. This change is not deployed.
- `public.complete_mygram_profile` is SECURITY DEFINER and executable by `authenticated`. Its inspected definition requires `auth.uid()`, accepts no caller-supplied user ID, uses an empty search_path and schema-qualified relations, validates inputs, and writes the authenticated user's own profile/private/preference rows. Treat the Advisor WARN as an intentional privileged-RPC review item requiring independent negative tests, not as proof of exploitation.
- Leaked-password protection is disabled; no Auth setting was changed.

### Production

- Advisor findings identify `join_meeting`, `transfer_meeting_chair`, and `update_meeting_status` as authenticated SECURITY DEFINER RPCs. Their inspected bodies include `auth.uid()` and meeting-role/state checks; grants observed were `authenticated`, `postgres`, and `service_role`, not PUBLIC. They still require independent review because they execute with owner privileges and use a non-empty search_path.
- Performance findings include five unindexed foreign keys, 65 unused indexes, and six tables with multiple permissive SELECT policies. No index or policy was changed.

## Remaining hard blockers

1. Security must approve an immutable trusted workflow-file SHA before W10 may replace the null `workflow_sha`.
2. Deployed QA Edge Function source provenance is still unproven; `qa-authz-two-user` remains source-only.
3. No Staging QA invocation is authorized. A/B/C AuthZ, access-token expiry behavior, signed URL expiry/revocation, and runtime cleanup remain unproven.
4. Feed privacy remains blocked by missing audience schema and existing broad SELECT policies.
5. Same-post nested-comment integrity remains a proposal; no migration may be applied without separate approval.
6. Five applied Staging migration versions still lack recovered original SQL sources.
7. Central CI's integration-target trigger is not yet on the integration branch; PR #97 has no CI result.
8. Android has no emulator/physical-device acceptance evidence.

## Protected operations

No PR was merged. No public deployment, Production write, Staging write, migration, RLS/Auth/Storage/Realtime change, Edge Function deployment, secret change, QA invocation, tester invitation, APK distribution, or release action occurred.

**Decision:** X12 has produced source-level progress and exact-head CI evidence, but no function has crossed the formal acceptance gate. Gate A remains OPEN; Release Ready remains NO.
