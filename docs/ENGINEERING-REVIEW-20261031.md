# MYGRAM | Verified Engineering Review — 2026-10-31

## Executive decision

**Continue rebuild, keep Gate A OPEN, and do not distribute APK or activate tester memberships yet.** The report's major findings are supported by live repository/CI/DB evidence. Two important clarifications are added below: Staging's base `profiles` table is not directly selectable by `authenticated`, and Staging's safe `public_profiles` view has both `security_invoker` and `security_barrier`; the confirmed broad Staging read issue is the FB feed tables.

## 1. GitHub and CI evidence

- Repository: `MYGRAM-DB/mygram-app`.
- Rebuild branch HEAD when this review began: `4fa0e5e39d3ee903efdd17b149ac6a1ec356d279`.
- [Run #119](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41178528083): **SUCCESS** on that exact SHA. Both current jobs completed successfully:
  - `Typecheck, unit tests, Playwright, and production build`.
  - `Real JWT, Profile Privacy, Storage, Messenger A/B/C, and Realtime`.
- CI source proves the second job calls only `qa-messenger-abc`.
- CI syntax-checks `tests/authz.integration.mjs`; syntax validation is not an AuthZ runtime test.
- `qa-authz-two-user` exists in the repository source but is not among the deployed Staging Edge Functions. The only deployed Edge Function observed is `qa-messenger-abc`.
- PR #54 remains **Open / Draft / Not Merged**, based on `main`.
- The three tracking issues created from this review:
  - [#55 Staging membership, RLS and AuthZ](https://github.com/MYGRAM-DB/mygram-app/issues/55).
  - [#56 Capacitor Android APK](https://github.com/MYGRAM-DB/mygram-app/issues/56).
  - [#57 Production profile privacy proposal, Staging only](https://github.com/MYGRAM-DB/mygram-app/issues/57).

## 2. Exact schema counts verified

Read-only SQL checks returned:

| Metric | Production | Staging |
|---|---:|---:|
| `public` base tables | 51 | 15 |
| `public` RLS policies | 144 | 32 |
| `supabase_migrations.schema_migrations` rows | 46 | 17 |

All 15 Staging public base tables reported RLS enabled. These counts match the supplied report.

### Staging migration-source mismatch

The rebuild branch currently contains **12** `supabase/migrations/*.sql` files, while Staging records **17** migrations. Five recorded versions currently have no matching SQL source file in the branch:

- `20261029200719_create_profile_for_new_auth_users`
- `20261029200728_revoke_public_execute_handle_new_user`
- `20261029211249_mygram_staging_profiles_rls_core`
- `20261029223828_create_supported_locales_public_read`
- `20261030194646_enable_messenger_postgres_changes`

This is a source-of-truth and reproducibility blocker. Recover the exact SQL from a trusted backup/history or migration export, verify provenance and checksums, then add the missing source. **Do not rewrite migration history, reset Staging, or invent equivalent SQL and pretend it is the original.**

## 3. Staging access-control findings

### Confirmed broad FB feed reads — release blocker

These tables each have an `authenticated` SELECT grant and a SELECT policy using `USING (true)`:

- `public.posts` / `posts_select_authenticated`
- `public.post_comments` / `post_comments_select_authenticated`
- `public.post_reactions` / `post_reactions_select_authenticated`

Any signed-in user who can reach the Staging Data API can read the feed rows through those grants/policies, independent of membership in the intended private tester group. Treat this as **P1 / Gate A blocker**. Replace or narrow the existing policies; do not add another permissive policy, because permissive policies are OR-combined.

Also add active-membership checks to write policies where the preview requires membership, while preserving user ownership predicates.

### Profiles projection — safe boundary to preserve

The live Staging check confirmed:

- `authenticated` has **no direct SELECT grant** on `public.profiles`.
- The `profiles_select_public_projection` policy on the base table has `USING (true)`, but the absence of a table SELECT grant prevents direct base-table reads by `authenticated`.
- `public.public_profiles` is a view with both `security_invoker=true` and `security_barrier=true`.
- Its selected columns are a defined public projection and do not include `study_place`, `work_place`, or `profile_completed`.

Preserve this grant/view boundary. Do not grant direct SELECT on the base table merely to make profile queries work.

### Messenger and Storage

- Messenger policies enforce two-party conversation membership but do not also check preview-group membership.
- Both `profile-avatars` and `messenger-attachments` buckets are private.
- Their policies currently enforce ownership/conversation membership, not preview membership.
- Add the preview membership predicate without removing existing ownership/participant constraints. Test direct REST, Storage and Realtime access, including revoked users with an unexpired JWT.
- Keep the buckets private; no public bucket conversion.

### Profile/private-data grants and profile completion

Staging `profile_private_details` grants `SELECT` and `DELETE` to `authenticated`, but not `INSERT` or `UPDATE`. `complete_mygram_profile` is a SECURITY DEFINER RPC that checks `auth.uid()`, validates data, and performs the multi-table onboarding write.

The current source for `qa-authz-two-user` tries to create its private fixture rows with the A/B/C user JWTs via `INSERT`. That conflicts with the observed table grants and will fail when exercised unless corrected. Seed fixture rows using the server-side admin client inside the protected QA Edge Function; retain real A/B/C JWTs for the actual read/write denial tests. Do not grant broad client INSERT/UPDATE just to satisfy a QA fixture.

The Staging Advisor warning for `complete_mygram_profile` is a review item, not an automatic instruction to remove SECURITY DEFINER. It must be reviewed for caller authorization, fixed search_path, allowed inputs and intended table writes before any grant change.

## 4. Auth hook and invitation state

- No invitation or preview-membership table exists in the inspected 15 public Staging tables.
- A scan of visible PostgreSQL functions found no function named like a Before-User-Created / signup-invite handler.
- The deployed Staging Edge Function list contains only `qa-messenger-abc`; no dedicated signup-gate Edge Function was observed.
- The existing `on_auth_user_created` trigger calling `public.handle_new_user()` is present and must be preserved.
- Because Auth Hook settings are not exposed by the connected Supabase control actions, the precise dashboard hook enablement state could not be independently read in this check. Do not claim the hook is active.
- A signup hook alone is insufficient: it applies before new-user creation, not every login or existing session. Runtime RLS/Storage/Realtime membership checks remain required.
- Do not import the eight-address initial batch until the hook, schema and policies are deployed and denial-tested. No email list is committed to Git or copied into issue bodies.

## 5. AuthZ runtime suite — required corrections before deployment

The source-only `qa-authz-two-user` function is not ready to deploy/run yet:

1. CI does not invoke it. It invokes `qa-messenger-abc` only.
2. OIDC validation uses `workflow_ref.startsWith(...ci.yml@)`; the trust model needs a pinned trusted workflow identity/immutable revision and a verified PR-head provenance policy, not a loose prefix alone. Do not grant an OIDC-authorized QA function until reviewed.
3. It tries to insert `profile_private_details` through user A/B/C JWTs despite no authenticated INSERT grant. Move only fixture seeding to the admin client; keep all tested authorization requests on independent user JWTs.
4. It verifies refresh-token revocation, but explicitly does not claim the current access JWT is invalid before expiry. Add separate expiry/session and active-WebSocket/realtime tests.
5. Cleanup verifies private rows and Storage objects but does not independently query that every temporary Auth user is absent after deletion. Add independent absence checks and exception-isolated cleanup steps.
6. Use a separate fresh OIDC token for each protected QA Edge Function invocation because one-time challenge/replay controls exist.

Only after these items are fixed should the function be deployed to Staging and wired into a separate CI job.

## 6. Production findings — read-only

The supplied report's Production profile finding is confirmed:

- `authenticated` has direct SELECT on `public.profiles`.
- `profiles_select_authenticated` uses `USING (true)`.
- The base table contains study/work and location-related columns.
- Three profile rows existed at audit time.
- Aggregate checks found zero populated `study_place`, zero populated `work_place`, and zero hidden-but-populated location tuples.

This proves a broad access path is configured; it does **not** prove private values were actually read by another user. Classify as a P1 privacy remediation item, not a confirmed exfiltration event.

Production Advisor checks also returned:
- Three authenticated-executable SECURITY DEFINER functions: `join_meeting`, `transfer_meeting_chair`, `update_meeting_status`.
- Leaked-password protection disabled.
- Performance INFOs: five unindexed foreign keys and 65 unused-index suggestions.

Do not change Production in response to this review. Prepare a reversible migration proposal, validate on Staging, obtain independent human review, and request a separate Production authorization later.

## 7. Staging Advisor interpretation

- Three RLS-enabled/no-policy INFO findings apply to `qa_run_challenges`, `ui_translation_cache`, and `ui_translation_daily_usage`. These are intended backend-only tables; keep them inaccessible to browser roles and do not add permissive policies simply to silence the Advisor.
- One SECURITY DEFINER warning applies to `complete_mygram_profile`; see the review requirement above.
- Leaked-password protection is disabled. The project is on Free, and the feature is not available on the current plan; document as a plan-limited residual risk rather than repeatedly trying to enable it.

## 8. Android and native Auth

Repository checks confirm there is no Capacitor dependency/config, Android Gradle project, wrapper, APK script or Android CI job. The app signup path calls `supabase.auth.signUp({ email, password })` without `emailRedirectTo`, and no native `appUrlOpen`/cold-start deep-link handler was found.

The Android work can proceed in parallel using synthetic Staging configuration, but tester distribution waits for membership/security gates:
- Capacitor 8 pinned versions, local web assets, relative base path, no remote app shell.
- Exact Staging-only URL guard; reject Production and unknown endpoints.
- Native email-confirmation and recovery callback support.
- Gradle APK build, signature/package/permissions verification, SHA-256 and retained CI artifact.
- Physical device installation, keyboard/RTL/back-navigation/Auth/Messenger tests.

## 9. Initial tester roster

The initial batch file contains eight normalized unique addresses: one owner and seven provisional testers. Two roles were inferred as tester from the surrounding request because their original pasted lines did not include role text. The CSV is held outside Git; no invite records were created. Confirm the two inferred roles before activating them. The target remains one owner plus up to 50 testers; 43 additional testers are still needed.

## 10. Immediate order of execution

1. Recover the five missing Staging migration sources and prove provenance.
2. Design the private invite/membership schema and server-side signup gate.
3. Replace the three permissive feed SELECT policies and add active membership to required write/profile/Messenger/Storage/Realtime paths.
4. Preserve the secure profile projection and existing profile-creation trigger.
5. Correct and separately run AuthZ A/B/C with fresh OIDC identity, admin-only fixture setup, expiry/revocation and cleanup proof.
6. Only after the gate tests pass, import the initial eight invites and then additional addresses as received.
7. In parallel, add Capacitor Android source/build workflow and native Auth redirects using synthetic QA data.
8. Test APK on the owner's physical phone, then begin the authorized tester rollout.
9. Prepare Production privacy remediation as a separate Staging-tested proposal; Production remains read-only.

## 11. Audit boundary

This review consisted of GitHub reads, CI status/log inspection, Staging/Production read-only SQL, table/grant/policy/view inspection, Advisor reads, and source inspection. **No database migration, Auth setting, Storage policy, Edge Function deployment, production change, tester invite import, Android build, or public deployment was performed in this review.**

