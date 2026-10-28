# MYGRAM rebuild — Phase 1 foundation

This phase establishes a safe additive baseline for the full rebuild. It does not claim that all nine product spaces are finished.

## Live database change

Migration: `platform_space_registry_and_delivery_status`

- Adds `public.platform_spaces`, a nine-space product registry.
- Adds `public.platform_feature_registry`, a feature delivery/verification registry.
- Enables RLS on both tables and permits authenticated read-only access; client-side writes are revoked.
- Does not drop or rewrite existing users, profiles, posts, messages, storage objects, or migrations.
- Seeds feature status conservatively: existing code/schema is marked unverified until real integration tests pass.

## Existing infrastructure discovered

The connected project already contains social, profile, messaging, community, meeting, localization and preference tables. RLS is enabled on the inspected tables. This phase therefore adds an additive registry rather than duplicating existing tables or destructively replacing user data.

## Remaining work

1. Audit every existing policy table-by-table, including private message membership and storage buckets.
2. Fix recipient search and run two-account live messaging tests.
3. Build the new responsive shell and real routes for all nine spaces.
4. Complete translation coverage beyond the 47 core strings currently documented; verify every visible UI string in all 60 locales.
5. Validate country/nationality catalog count and registration flows.
6. Test uploads, story expiry, video playback, call signaling, and auth email/SMS integrations.
7. Merge only after CI and manual end-to-end checks pass.

## Security boundaries

Never put a Supabase service-role or secret key in browser code. Phone OTP requires an enabled auth provider and configured SMS provider. Email delivery/confirmation requires correct redirect configuration and reliable SMTP.
