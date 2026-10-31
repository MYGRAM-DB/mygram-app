# MYGRAM | Android execution checkpoint — 2026-10-31

## Verified result

The Android Staging bootstrap has achieved its first real Gradle APK build, on the isolated branch and PR #59.

- Android branch: `feature/android-staging`.
- PR #59: [feat(android): bootstrap isolated MYGRAM Staging Android build](https://github.com/MYGRAM-DB/mygram-app/pull/59).
- PR head: `f2edc7fcc28c971bad4914c80b7408998da84218`.
- PR base: `rebuild/phase-a-architecture`, integration baseline `cd07676b98ca0c212a6a63f1cd0a17bf0cd814d7`.
- The PR contains 3 committed changed files: `.github/workflows/android-staging.yml`, `capacitor.config.json`, `vite.config.ts`.
- [Run #9](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41185503288) completed **SUCCESS** on exact head `f2edc7fcc28c971bad4914c80b7408998da84218`. All 14 principal workflow steps passed.
- The job log confirms Gradle `assembleDebug` returned `BUILD SUCCESSFUL`; APK identity is `com.mygram.app.staging`; target/compile SDK 36; Android v2 debug signer verification passed; only the declared Internet permission was present; `android:allowBackup=false`; Staging project ref was present; Production ref and `sb_secret_` pattern were absent.
- APK SHA-256 logged by the ephemeral runner: `e88e9202211e8b0ff534a5e98051695389ffa185b7c5603b67ec140b8c75206b`.
- Debug signing certificate SHA-256 logged by the runner: `e0dae79e70d3b8d749be8fd88aa9e962904ac67fac33a761b34dbec1805d57df`.

This establishes a successful **Staging Debug build in an ephemeral GitHub runner**, not a production/release-signed APK.

## Generated source artifact

- GitHub Actions source artifact ID: `13036279372`.
- Artifact size: 238,915 bytes.
- Expires: 2026-11-07 08:41:38 UTC.
- It contains a nested `android-source-review.zip`, comprising the generated Android/Gradle project, wrapper, Capacitor config, `package.json` and npm-generated `package-lock.json`.
- The APK binary was deliberately discarded after the checks and is not in the artifact.
- The source archive was downloaded and inspected. It contains no APK, no `local.properties`, no Google services file, no production project ref or `sb_secret_` match.
- The generated source and lockfile are **not yet committed to the Android PR**. PR #59 still has only the three files listed above. The archive is review material, not a repository source commit.

## Review findings / work remaining

1. **Commit generated source:** review and commit the Android project, wrapper, exact package manifest and lockfile to `feature/android-staging`. Re-run the Android build from a clean checkout where the native project is in Git; do not assume the artifact archive itself is a permanent source of truth.
2. **Native Auth is not implemented:** `AndroidManifest.xml` has only the launcher intent filter. The generated `MainActivity` is a plain `BridgeActivity`. No `appUrlOpen`, `getLaunchUrl()`, native URI intent filter, `emailRedirectTo` or password-recovery UI was found in the source archive / current app patch.
3. **Physical-device acceptance is outstanding:** no installed-device evidence exists for login, profile completion, Arabic RTL, keyboard, navigation, cold/warm auth callback or FB/Messenger smoke paths.
4. **Release signing is outstanding:** Run #9 uses Android Debug signing. It is valid for debug testing only, not a production release key or Play Store package.
5. **Security gate remains open:** Gate A still requires membership/signup enforcement, RLS, Storage/Realtime membership checks and independent `qa-authz-two-user` runtime tests. The current Staging CI suite is not that test.
6. **Distribution boundary:** repository visibility is public. Do not use public GitHub Actions artifacts as a private APK distribution channel. No APK was uploaded or distributed.

## Current PR/environment boundaries

- PR #59: Open / Draft / Not Merged.
- PR #54: Open / Draft / Not Merged.
- PR #55 tracking security/membership remains open; Gate A remains OPEN.
- Production remains READ-ONLY. No Supabase DB/Auth/Storage/Edge Function changes were made for this Android build.
- No invitation import, tester membership activation or APK distribution occurred.

---
*This checkpoint records verified build evidence and remaining acceptance gaps. It does not claim that Android is device-ready or release-ready.*
