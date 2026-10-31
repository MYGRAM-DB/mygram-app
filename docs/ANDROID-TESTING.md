# MYGRAM | DECISION 08 — Android APK test track

Date: 2026-10-31  
Repository: `MYGRAM-DB/mygram-app`  
Branch: `rebuild/phase-a-architecture`  
Staging project ref: `cbyvtehvaojxfcgpelir`  
Production project ref: `rocztskcyakvekokftfx` (READ-ONLY)

## 1. Decision

Add a separate Android test-build lane so the owner and up to 50 approved testers can install MYGRAM on physical Android phones.

- No PageShare, PageShare Premium, paid build service, paid distribution subscription, or payment card.
- Android test APK must use Staging only.
- Production remains read-only. No Production URL, credentials, schema, Auth, Storage, Edge Function, or deployment change.
- PR #54 remains Open / Draft / Not Merged.
- The APK is a mobile shell around the current React/Vite application, not proof that all nine MYGRAM products are complete.
- The APK must bundle the built web assets locally. It must not load the app shell from a public website using Capacitor `server.url`.
- The APK communicates with Supabase Staging over HTTPS for authentication and data. A locally bundled shell does not make the backend data available offline.
- No APK may be distributed to testers until Staging membership, RLS, Storage, Auth redirect, and real-device gates pass.

## 2. Verified repository baseline

The following was checked on the branch before this documentation-only decision:

- Parent HEAD: `cf5c848879d218f76fdc5133589ef7a99e0b2877`.
- [Run #117](https://github.com/MYGRAM-DB/mygram-app/actions/runs/41150200153) completed SUCCESS on that parent SHA. It does not test Android packaging or independently execute `qa-authz-two-user`.
- No `android/` directory, Capacitor config, Gradle wrapper, or Android build job exists in the repository tree.
- `package.json` has no Capacitor dependencies or Android scripts.
- Existing CI builds React/Vite and runs Playwright against a local Vite server only.
- `vite.config.ts` currently sets `base: "/mygram-app/"` and `sourcemap: true`. This is not the correct asset path/security profile for the APK.
- `src/lib/supabase.ts` currently enables `detectSessionInUrl`, but there is no Capacitor App deep-link handler.
- Current `signUp` call does not set a native `emailRedirectTo`. Email confirmation/password recovery cannot be assumed to return correctly to an installed APK until deep linking is implemented and tested.

## 3. Android packaging architecture

Use Capacitor 8.x as the native Android bridge for the current React/Vite app. Pin exact matching versions of `@capacitor/core`, `@capacitor/android`, `@capacitor/app`, and `@capacitor/cli` in `package.json`/lockfile; do not mix major versions or use a preview package.

Provisional Staging-only identity:
- App display name: `MYGRAM STAGING`.
- Android application ID: `com.mygram.app.staging`.
- The production Play Store package identity, if ever required, must be decided separately. Do not reuse a staging ID as a production decision without review.

Capacitor config requirements:
- `webDir: "dist"`.
- No remote `server.url`.
- Add `android/` native source to version control after generation.
- Do not commit `android/local.properties`, machine-specific SDK paths, keystores, signing passwords, or other local secrets.
- Vite Android build must use relative asset paths (`base: "./"`) so JS/CSS/assets load from the APK WebView origin.
- Disable production source maps in the APK build.
- Keep the existing web-preview base-path decision separate; do not silently break GitHub Pages/local web tests to make APK work.

Official prerequisites to validate against the selected Capacitor 8 patch release:
- Node.js 22 or newer.
- Android Studio 2025.2.1 or newer.
- Android SDK Platform 24 or newer.
- Capacitor 8 Android runtime support starts at Android API 26 (Android 8). Test actual devices at the minimum supported API and a current Android release.
- Use the JDK/Gradle combination required by the generated Capacitor Android template; record exact Gradle, Android Gradle Plugin, JDK, compile SDK, target SDK, and min SDK in the build log rather than guessing versions.

Official references:
- https://capacitorjs.com/docs/getting-started
- https://capacitorjs.com/docs/getting-started/environment-setup
- https://capacitorjs.com/docs/android
- https://capacitorjs.com/docs/apis/app

## 4. Required build sequence

1. Add and lock compatible Capacitor packages.
2. Add a TypeScript Capacitor config with the Staging package identity and bundled `dist`.
3. Add a dedicated `build:android` command using `vite build --base=./`, TypeScript validation, and source-map disabling.
4. Add a build guard that:
   - Requires `VITE_SUPABASE_URL`.
   - Parses and verifies the exact Staging project ref `cbyvtehvaojxfcgpelir`.
   - Rejects the Production ref `rocztskcyakvekokftfx` and every unknown Supabase host.
   - Allows only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the browser build.
   - Fails if a service-role key, secret key, database password, or privileged credential is present in the environment or generated APK assets.
5. Run `npm run build:android`.
6. Run `npx cap sync android`.
7. Run the Gradle debug build: `cd android && ./gradlew assembleDebug`.
8. Verify APK application ID, version, signing certificate, requested permissions, and embedded Supabase Staging URL.
9. Generate a SHA-256 checksum and record commit SHA, workflow run ID, build number, package ID, version, SDK versions, and checksum.
10. Upload the APK as a GitHub Actions artifact for a short retention period (14 days is the initial policy). Fail the workflow if the APK is missing.
11. Do not add an automatic Production release or Play Store publishing step.

Initial test build:
- Produce a debug APK using Gradle's debug signing configuration.
- Debug signing is strictly for internal QA. It is not a production/release signature.
- No private release keystore is created, checked into Git, or exposed to CI for this stage.
- Expected output: `android/app/build/outputs/apk/debug/app-debug.apk`.
- Artifact name should include `MYGRAM-STAGING`, run number, and short commit SHA.
- Confirm signature using Android's `apksigner verify` and publish a SHA-256 checksum.

## 5. Supabase Auth deep-link requirement

The APK is not accepted until confirmation and recovery links return to the installed application.

- Register a unique Staging callback such as `com.mygram.app.staging://auth/callback` in the Staging project's allowed redirect URLs only.
- Configure native signup to pass the approved callback through `emailRedirectTo`.
- Add Capacitor `@capacitor/app` listener handling for both `appUrlOpen` and cold-start `getLaunchUrl()`.
- Use a deliberate PKCE/OTP callback implementation compatible with the actual Staging email template. Verify whether the callback contains a PKCE `code` or a token hash before choosing `exchangeCodeForSession` or `verifyOtp`; do not assume the response shape.
- Add the password recovery flow and a native callback route before declaring Auth ready.
- Clear or replace callback URLs after processing. Never print authentication codes, token hashes, access tokens, refresh tokens, or full auth URLs in logs, screenshots, analytics, or crash reports.
- Update Supabase Auth redirect allowlist and email templates on Staging only. Do not alter Production Auth settings.
- Test installed-app cold start, app already running, invalid/expired callback, repeated callback, confirmation, recovery, sign-out, and session restoration.

Supabase references:
- https://supabase.com/docs/guides/auth/native-mobile-deep-linking
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/auth-email-templates

## 6. Staging membership and database authorization are release blockers

Read-only Staging verification established:
- `auth.users` has an `AFTER INSERT` trigger named `on_auth_user_created` calling `public.handle_new_user()`.
- The current `handle_new_user()` function is SECURITY DEFINER with an empty search_path and inserts the associated `public.profiles` row. Preserve this behavior and test idempotency; do not drop or bypass the trigger.
- No invitation/membership table was present in the inspected public table list.
- `posts_select_authenticated`, `post_comments_select_authenticated`, and `post_reactions_select_authenticated` currently use `USING (true)` for authenticated reads.
- Messenger policies check conversation membership, but do not yet apply MYGRAM preview membership.
- Both `profile-avatars` and `messenger-attachments` Storage buckets are private. Keep them private.

Mandatory design:
1. Create an internal Staging invitation/membership model for one owner plus a maximum of 50 testers. Do not put the CSV in Git, public artifacts, client bundles, or CI logs.
2. Restrict invitation/membership tables to server-side administrative paths. Testers must not be able to add themselves, change roles, extend expiry, or reactivate revoked memberships.
3. Configure Supabase `Before User Created` to reject any new signup without a valid, unexpired, unused invitation. This is a signup gate only, not a substitute for runtime membership authorization.
4. Preserve `on_auth_user_created` and `handle_new_user()`. Add the membership attachment to the same user-creation transaction only after validating the invitation; preserve the existing profile insert.
5. Replace or narrow the existing permissive `USING (true)` feed read policies. Do not add a second permissive policy beside the old one: permissive policies are OR-combined and the old policy would continue to allow access.
6. Apply active-membership checks to all exposed Staging data tables, Messenger conversations/messages/participants/attachments, Storage object policies, and Realtime channel authorization. Keep owner/participant constraints in addition to membership.
7. Revocation must block new REST, Storage, and Realtime access even where the user still holds an unexpired JWT. Test already-open WebSocket/channel behavior; do not assume a changed database flag disconnects an established Realtime connection automatically.
8. Keep the invitation lookup and membership authorization function narrowly scoped, with explicit grants/revokes and hardened search_path. Do not use user-editable `user_metadata` for roles. Do not weaken RLS or make a bucket public.
9. Validate A (owner), B (invited tester), and C (non-invited/revoked identity) with independent real JWTs and direct API attempts.

The owner/tester CSV is still required. The file must contain exactly one `owner` row plus no more than 50 `tester` rows, with normalized unique email addresses. Do not infer or invent the owner's email.

## 7. Distribution without paid services

First delivery:
- Use the GitHub Actions artifact from the private repository. Only repository-authorized people can download it.
- The owner can install it directly or transfer the APK to test devices using a trusted local method.
- Provide the SHA-256 checksum with the APK; testers must compare the checksum before installation.

Group distribution option:
- Firebase App Distribution is listed as a no-cost Firebase product.
- Published limits: up to 500 testers per Firebase project and up to 200 testers in an App Distribution group. A single group can accommodate the 51 intended users.
- Use Firebase only as an APK distribution service if the owner chooses to configure it. Do not add Firebase Auth, Firebase Database, or Firebase SDKs to the MYGRAM application for this purpose.
- Firebase project/app registration and credentials are not currently configured or verified. Do not claim distribution is active before that setup is complete.
- If Firebase is not configured, the GitHub artifact/manual transfer remains the zero-cost fallback.

References:
- https://firebase.google.com/pricing
- https://firebase.google.com/docs/app-distribution/troubleshooting

## 8. Physical-device acceptance matrix

At minimum test:
- One Android 8 / API 26 device or emulator, and one current Android device/emulator.
- A compact phone viewport and a typical large phone viewport.
- Fresh installation, first launch, restart, background/foreground, app force-close, and update installation over the previous test APK.
- Arabic RTL layout, dark/light mode, text wrapping, touch target sizes, status/navigation bar and safe area, keyboard resize, scrolling, and Android back navigation.
- Email signup, confirmation deep link, login, persistent session, logout, password recovery, invalid/expired link, and revoked membership.
- A/B social feed, post/comment/reaction authorization, and C denial.
- A/B Messenger, attachment picker, private attachment download, Realtime, and C denial.
- Network loss/recovery, slow network, server error, and no Supabase configuration.
- No unnecessary camera, microphone, contacts, phone, location, or broad storage permissions. Add a runtime permission only when an implemented feature genuinely requires it.
- No HTTP cleartext traffic. No WebView remote debugging in distributed debug APKs unless temporarily enabled on a developer-only build.
- Verify no fatal crash, no blank screen, no missing local assets, and no auth secrets in logs.

Current app scope must remain honest: MYGRAM FB and MYGRAM MESSENGER are partial; the other seven products remain unimplemented. The APK can only validate functionality that exists and is wired to Staging.

## 9. Completion criteria

Do not mark the Android gate complete until all are true:
- Native source is committed and reproducibly builds from a clean checkout.
- CI builds the APK on the intended rebuild branch and uploads the artifact.
- Staging environment guard passes; Production ref/secret injection negative tests fail the build.
- Auth deep-link and password recovery paths pass on installed Android devices.
- Invitation and membership tests A/B/C pass with real JWTs.
- Existing broad RLS policies have been narrowed and verified, not merely supplemented.
- Storage buckets remain private and membership revocation is tested against REST, Storage, and Realtime.
- APK signature, package ID, SHA-256 checksum, version, and build provenance are recorded.
- Owner installs and confirms the APK on at least one physical phone.
- The tester distribution path is proven without any paid subscription.
- Gate A remains OPEN until every independent security test, rollback, and evidence requirement is complete.

No Production mutation, PR merge, public release, or app-store publication is authorized by this decision.
