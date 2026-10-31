# MYGRAM | DECISION 13 — Android execution enablement and parallel delivery controls
Date: 2026-10-31
Repository: `MYGRAM-DB/mygram-app`
Integration branch: `rebuild/phase-a-architecture`
Android branch: `feature/android-staging`
Integration baseline: `320b3b3cd15003e0fe01f09ac6f6cbf33c07ac0b`
PR #54: Open / Draft / Not Merged
Production: READ-ONLY
Gate A: OPEN

## 1. Executive order

The Android branch exists, but it is **not an Android implementation yet**. The branch was created from the earlier integration commit `b4adbd1fb2178f5711782c2a6748ff85e3e57c50`; its tree did not contain Capacitor configuration, Android native source, Gradle wrapper or an Android build workflow. It was fast-forwarded without source changes to the current integration baseline `320b3b3cd15003e0fe01f09ac6f6cbf33c07ac0b` so that implementation begins from the current reviewed code.

The absence of a local npm/Gradle runner in the current GitHub connector is not a reason to fabricate a lockfile or stop all work. The preferred build execution path is a controlled GitHub-hosted Actions runner, with a local/ChatGPT Work development environment as an optional alternative. Neither environment is claimed to have built an APK yet.

## 2. Verified facts

- [Run #121](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41181799872): SUCCESS on `b4adbd1fb2178f5711782c2a6748ff85e3e57c50`.
- [Run #122](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41183762660): SUCCESS on exact integration commit `320b3b3cd15003e0fe01f09ac6f6cbf33c07ac0b`; both existing jobs passed.
- Both workflows run the current web/Playwright quality job and existing Staging security job. The Staging job invokes `qa-messenger-abc`, not the independent `qa-authz-two-user`.
- PR #54 remains Open / Draft / Not Merged and points to `320b3b3cd15003e0fe01f09ac6f6cbf33c07ac0b`.
- `feature/android-staging` was verified at `b4adbd1fb2178f5711782c2a6748ff85e3e57c50`, then fast-forwarded to `320b3b3cd15003e0fe01f09ac6f6cbf33c07ac0b`. The compare showed one documentation-only commit; no Android code changes were lost or overwritten.
- On the Android branch at the inspected baseline: `package.json` has no Capacitor packages or Android scripts; no `capacitor.config.ts`, `android/`, Gradle wrapper or Android workflow exists.
- `vite.config.ts` still sets `base: "/mygram-app/"` and `sourcemap: true`.
- The signup path still calls `signUp({ email, password })` without native `emailRedirectTo`; native cold/warm deep links and password recovery are not implemented.
- No APK was built or installed by this decision. No Staging or Production configuration was changed.

## 3. Android work package — strict ownership of `feature/android-staging`

Only the Android lane may modify its scoped files on this branch. Do not edit the integration branch directly. Changes must be presented as a focused PR/patch targeting `rebuild/phase-a-architecture`; PR #54 itself remains Draft/Open/Not Merged.

### A. Dependency and native project bootstrap

1. Use Node 22.16.0 to match the existing CI runtime.
2. Add compatible Capacitor 8 packages for `@capacitor/core`, `@capacitor/android`, `@capacitor/app` and `@capacitor/cli`. Resolve and validate exact compatible versions; save exact versions, not broad ranges.
3. Generate `package-lock.json` with npm itself. Never hand-author the lockfile.
4. Run `npm ci` from the resulting committed lockfile and verify a clean-checkout install.
5. Generate the native project using the pinned Capacitor CLI. Commit the actual generated `android/` project and wrapper after review. Never submit placeholder Gradle files.
6. Keep machine-specific SDK paths, local.properties, signing keystores/passwords and secrets out of Git.

### B. Separate Staging web build

Preserve the existing web build behavior. Add a dedicated Android build mode/script:
- Android `base: "./"` so all bundled assets resolve inside the WebView.
- Android build `sourcemap: false`.
- `webDir: "dist"`.
- Staging app identity `com.mygram.app.staging`.
- Reject Production or unknown Supabase project references at build time. Only Staging ref `cbyvtehvaojxfcgpelir` is accepted.
- Only the Supabase URL and publishable client key may be included. No Service Role/Secret, private API key or privileged credential may enter the bundle, APK, source map, log or artifact.
- Do not configure Capacitor `server.url`; the app shell must be bundled locally. Backend calls may reach Staging over HTTPS.

### C. Native Auth return path

Implement and test:
- A single explicitly registered callback URI for email confirmation and password recovery.
- Supabase signup `emailRedirectTo` and password recovery redirect configuration.
- Capacitor `appUrlOpen` handler for warm-start links and `getLaunchUrl()` for cold-start links.
- PKCE/session exchange and state validation; do not log authorization codes, access tokens or refresh tokens.
- Valid reset flow through the installed app, password update, session refresh and safe navigation.
- Supabase Auth redirect allowlist and Android intent filters must match the exact approved URI.

### D. Reproducible Android build lane

Use a GitHub-hosted Actions runner as the initial no-cost build execution option, subject to the repository's actual GitHub Actions quota/limits. The workflow should:
- Be manually dispatched on `feature/android-staging` initially; enforce the exact branch/ref and expected Staging project.
- Use a pinned Node version and Java/Android toolchain compatible with the resolved Capacitor version.
- Have `contents: read`; no `id-token: write`, no deployment credentials, no Service Role and no automatic push token.
- Build locally bundled assets, run Capacitor sync, then execute Gradle `assembleDebug`.
- Verify package ID, APK signature, manifest permissions, embedded Supabase target and secret scan.
- Calculate SHA-256 and print artifact provenance (run ID, commit SHA, toolchain versions).
- Upload generated Android source and build diagnostics as review artifacts only when safe. Do not auto-commit runner-generated code with a write-enabled token. Review generated files, then commit them through the controlled branch process.

### E. Artifact privacy — public repository restriction

The repository is currently public. GitHub documents that anyone with read access to a repository can list, retrieve and download its Actions artifacts. Therefore:
- Do not treat Actions artifacts as a private APK distribution channel.
- Do not upload a tester-distribution APK, private tester data, test credentials or confidential build material to this public repository's artifacts.
- The first build may compile and verify the APK on the ephemeral runner and retain only non-sensitive pass/fail metadata and SHA in the workflow log. Do not publish a downloadable APK artifact.
- Before owner-device transfer, choose an owner-controlled private transfer path with access restrictions, or obtain a separate explicit authorization to make the APK public. No paid service is assumed.
- No public GitHub Release, public download link or tester distribution under this decision.

GitHub reference: [REST API — Actions artifacts](https://docs.github.com/en/rest/actions/artifacts), which states that anyone with read access can list/get workflow artifacts and download them.

## 4. Parallel execution — no idle dependency

While Android source/build work proceeds on its isolated branch:
- Lane A continues trusted migration-source recovery and membership/RLS/AuthZ design; no uncertain Staging DDL is applied.
- Lane C continues FB/Messenger user-journey and UI fixes using approved fixtures; no client-side RLS bypass.
- Lane F prepares real A/B/C test cases, SMTP/recovery test plan and independent release checklist.
- Lane E continues translation key parity and RTL/LTR automation.
- All nine product tracks continue requirements, threat models and API/schema contracts under Decision 12; implementation dependencies are respected.

No stream may modify files/schema owned by another stream without a reviewed hand-off. A single integrator advances the integration branch.

## 5. Android acceptance gate

The Android issue is complete only when all are evidenced on an exact commit:
1. Pinned Capacitor dependencies and committed lockfile install with `npm ci`.
2. Actual generated Android project and Gradle wrapper are checked in.
3. Clean runner builds `assembleDebug` reproducibly.
4. APK embeds only Staging URL/ref and publishable key; secret scan is clean.
5. Package ID is exactly `com.mygram.app.staging`; signature verifies; only necessary permissions are present.
6. Confirmation and recovery links work from cold and warm app starts on a physical device.
7. Owner confirms installation and verifies Arabic RTL, keyboard, Back navigation, login, onboarding, FB and Messenger smoke paths.
8. APK delivery mechanism's access policy is verified before sharing. No tester rollout until Gate A, independent security review and owner authorization pass.

## 6. Non-negotiable boundaries

- No fabricated package-lock, Android directory, Gradle wrapper, APK or test result.
- No tester invitations/membership import before Gate A passes.
- No tester APK distribution before Gate A and Android acceptance pass and independent human review is recorded.
- Production remains read-only.
- Keep PR #54 Open / Draft / Not Merged.
- No paid provider/distribution service, PageShare, Play Store release or public preview under this decision.

---
*Decision 13 records verified branch/runner facts and directs the Android execution path. It does not claim an APK has been built.*
