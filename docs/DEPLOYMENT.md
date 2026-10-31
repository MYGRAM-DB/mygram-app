# MYGRAM | Deployment and CI/CD Control

## 1. Current verified posture | 2026-10-31

- Repository: `MYGRAM-DB/mygram-app`.
- Default branch: `main`.
- Active development branch: `rebuild/phase-a-architecture`.
- Current rebuild HEAD: `da49c3826318b372cf706e3e2b07ec1b2d67b459`.
- PR #54 remains Open / Draft / Not Merged.
- Active GitHub rulesets:
  - `main-branch-protection` (ID `26248287`): PR review, one approval, required CI checks, conversation resolution, up-to-date branch, deletion and force-push protection.
  - `rebuild-branch-safety` (ID `26248473`): deletion and force-push protection on the rebuild branch.
- Production remains read-only. No Production deployment is authorized.

## 2. Human-accessible Staging web application: not yet deployed

The current repository does not provide a live Staging web URL for the owner to test.

Evidence:
- `.github/workflows/ci.yml` is the only workflow currently present under `.github/workflows`.
- It runs verification and the existing Staging security integration suite; it does not publish `dist/` to a hosting provider.
- Playwright uses local base URL `http://127.0.0.1:5173/mygram-app/` and starts Vite locally.
- `npm run dev` and `npm run preview` run local developer servers. They are not persistent hosted previews.
- `vite.config.ts` sets `base: "/mygram-app/"`; this path setting alone does not configure or prove a GitHub Pages deployment.

Therefore CI success is not equivalent to a deployed website, and CI-local Playwright tests are not a substitute for human browser acceptance.

## 3. MY-0410 | Required Staging preview design

Create a separate, access-controlled preview deployment from `rebuild/phase-a-architecture` only.

### Hosting and access
- Use a hosting target that supports access restriction to the repository owner and explicitly approved testers.
- Keep the preview separate from the existing/default GitHub Pages or Production origin. Do not overwrite an existing site.
- Do not use public GitHub Pages or an unrestricted public static site as the default private preview.
- If the selected provider cannot restrict access, stop and request explicit approval before publishing a public preview.
- Use a manual, gated deployment trigger or a protected GitHub Environment such as `mygram-staging-preview`. Do not automatically deploy untrusted pull-request code with secrets or OIDC privileges.

### Build-time environment isolation
- Allowed browser build variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- The only allowed Supabase project for this preview is Staging ref `cbyvtehvaojxfcgpelir`.
- The Production ref `rocztskcyakvekokftfx` must cause the build/deploy guard to fail.
- Never put `SUPABASE_SERVICE_ROLE_KEY`, secret API keys, database passwords, or any privileged credential in a `VITE_*` variable, static asset, source map, or browser bundle.
- Use synthetic QA data only. Do not copy Production personal data into Staging.

### Deployment workflow requirements
1. Check out only the explicitly selected rebuild-branch commit.
2. Validate that the branch and commit are expected.
3. Validate the Supabase URL project ref against the Staging allowlist and reject Production.
4. Install from the committed lockfile.
5. Run TypeScript, unit, Playwright, and build gates.
6. Generate `dist/` using the Staging public configuration.
7. Scan the build output and source maps for privileged keys and forbidden Production endpoints.
8. Publish to the restricted preview origin.
9. Run post-deploy smoke checks against the actual hosted URL.
10. Publish the URL, commit SHA, deployment ID, and smoke-test results as a CI summary.
11. Keep a one-click rollback to the previous known-good preview deployment.

## 4. Human browser acceptance checklist

A human-accessible preview is accepted only after:

- The owner can open the URL in a clean browser without local Node.js or terminal setup.
- The shell and navigation load with no fatal console errors or missing assets.
- Dark/light mode, responsive navigation, and Arabic RTL are checked.
- The Auth flow is tested against Staging only.
- Onboarding and profile completion are tested with QA identities.
- FB feed, comments, and reactions are checked only to the extent implemented.
- Messenger A/B conversations, Realtime, attachment permissions, and cross-account isolation are checked.
- Sign-out and session expiry/recovery boundaries are recorded.
- Any missing, broken, or placeholder service is explicitly marked, not represented as complete.

Product scope must remain honest: only MYGRAM FB and MYGRAM MESSENGER are currently marked partial; the other seven products are not implemented in the current Staging app.

## 5. Existing CI scope

The current `.github/workflows/ci.yml` has two jobs:
- `Typecheck, unit tests, Playwright, and production build`.
- `Real JWT, Profile Privacy, Storage, Messenger A/B/C, and Realtime`.

The first job runs Playwright against a local Vite server. Its `node --check tests/authz.integration.mjs` step validates JavaScript syntax only. The second job currently invokes `qa-messenger-abc`; it does not invoke `qa-authz-two-user`.

Do not report the independent AuthZ suite as passed until its function is reviewed, deployed to Staging, invoked with a separate fresh OIDC token, and its runtime checks and cleanup proof pass.

## 6. Current execution evidence

- Run #116 [41149322936](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41149322936): SUCCESS on `da49c3826318b372cf706e3e2b07ec1b2d67b459`.
- Run #115 [41149093354](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41149093354): SUCCESS on `8630647227ea0a21fca4f98c990acc4af168b57a`.
- Run #113 [41147962375](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41147962375): CANCELLED.
- PR #54: Open / Draft / Not Merged.

## 7. Staging and Production boundaries

- Staging project ref: `cbyvtehvaojxfcgpelir`.
- Production project ref: `rocztskcyakvekokftfx`.
- Staging changes require impact assessment, reviewed migration/source, backup/rollback plan, and successful post-change tests.
- Production stays read-only until a separate explicit release decision.
- No public product launch, PR merge, or Production deployment is authorized by this document.

## 8. Release gates

Production cannot be considered for release until all are satisfied:
- AuthZ fixtures and trust model fixed and reviewed.
- Independent AuthZ runtime CI gate passes.
- Signed avatar URL authorization and expiry contract passes.
- Migration sources and Validator reconciled.
- Production privacy remediation has a reviewed and Staging-tested migration plus rollback plan.
- SMTP, email confirmation/recovery, session lifecycle, and phone-verification scope are proven.
- Human-accessible Staging preview is deployed and accepted.
- Product feature status matches actual working behavior.
- Rollback and post-deploy smoke checks pass.
