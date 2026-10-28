# MYGRAM Phase 2 — Platform shell and security review

## Implemented in this branch
- Added `platform.html`, a responsive workspace shell with nine product spaces.
- Added `platform-shell.css` for mobile/desktop layouts, dark/light themes, and RTL/LTR layout support.
- Added `platform-shell.js`, which reads `platform_spaces` from Supabase and renders live status labels. If the registry cannot be read, it clearly falls back to local status rather than pretending the live connection succeeded.
- Added navigation to existing real app routes (home, services, people, profile). The shell labels spaces requiring integrations or end-to-end verification instead of claiming they are complete.
- Theme and direction preferences persist in localStorage.

## Security review snapshot (live Supabase)
At review time, all 51 public base tables reported RLS enabled (0 disabled). The two new registry tables are read-only to authenticated clients with client-side writes revoked.
The audit also found intentionally broad authenticated SELECT policies on public social surfaces (posts, profiles, comments, reactions, communities and reels). These may be appropriate for public content, but each needs a data-classification review before launch. In particular, `community_members` and `live_sessions` expose membership/session rows to authenticated users under broad read policies; confirm this is intentional and narrow them if those rows contain private membership or meeting metadata. No destructive policy changes were made in this phase, to avoid breaking current user flows without table-by-table review.

## Known limitations
- This shell is a new entry page at `platform.html`; it does not replace the existing login entry or destructively rewrite existing pages.
- The nine entries link to current existing routes where available. AI provider tools, independent short-post composer, complete video hub, and real meeting calls still need their own implementations/integration verification.
- Only English and Arabic strings are included in this shell. It does not claim complete 60-language coverage.
- A successful registry query and responsive CSS have not yet been validated by a real browser/Playwright run in this phase.
