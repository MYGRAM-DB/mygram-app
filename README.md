# MYGRAM 2.8

Static web app (HTML/CSS/JS) on GitHub Pages + Supabase (Auth, Postgres, Storage).

## What this release fixes
- `config.js` only defined `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`, but `auth/home/people/profile/services/account-menu` read `supabaseUrl`, `supabaseKey`, `homeUrl`, `loginUrl` (all `undefined` -> clients failed to start). Both key styles are now defined.
- `app.js` queried a `profiles` table; every other page uses `users`. Unified on `users`.
- `app.js` used bucket `post-media`; other pages use `mygram-media`. Unified.
- The repo had no SQL (profile.js referenced a missing `MYGRAM-2.7-setup.sql`). Added `supabase/migrations/20261024000000_mygram_core.sql`.
- Added `.nojekyll`, `tests/check.js`, and a workflow that runs the checks.

## Install
1. **Inspect legacy data first** (Supabase SQL editor): `select count(*) from public.users; select count(*) from public.messages;` and confirm `public.users.id` is `uuid`.
2. Run `supabase/migrations/20261024000000_mygram_core.sql` (idempotent; drops nothing).
3. Auth -> URL Configuration: Site URL `https://mygram-db.github.io/mygram-app/`; add the same + `/home.html` to Redirect URLs.
4. Push the contents of `app/` to the repo root (not the ZIP itself). Pages serves from the root.
5. `node tests/check.js`

## Status (honest)
Working in code, **not yet live-tested**: signup/login, auto profile creation, profile edit + avatar/cover upload, posts with media, reactions, comments, friend requests, stories, reels, direct messages (no realtime yet).
Not implemented: groups, pages, notifications, blocking/reporting, realtime, password recovery UI, search beyond user lookup, AI assistance. Live streaming is a placeholder (`provider: external-provider-required`).

## Troubleshooting
- "client failed to start": hard-refresh; confirm `config.js` loads before page scripts.
- Upload fails: migration not run (bucket/policies missing).
- Login works but profile empty: run the backfill section of the migration.
- Email confirmation link goes to wrong URL: fix Auth URL Configuration (step 3).
