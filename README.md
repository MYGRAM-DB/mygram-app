# MYGRAM

MYGRAM is a static HTML/CSS/JavaScript social platform deployed with GitHub Pages and backed by Supabase Auth, Postgres, and Storage.

## Implemented in the repository

- Email/password sign-in, sign-up, password recovery UI, session guards, and profile creation.
- Phone-number formatting/validation and a 205-country calling-code catalog. Real SMS OTP requires enabling Supabase Phone Auth and configuring an SMS provider.
- Profile editing, avatar/cover media, country/language preferences, member discovery, and friend requests.
- Feed posts, image/video attachments, comments, and eight reaction types.
- Stories with expiry filtering and owner deletion.
- Reels with video publishing, emoji reactions, comments, and owner deletion.
- Direct Messenger with text, image/video/audio attachments, microphone voice recording, rounded message bubbles, recipient avatar/name, privacy-aware online/last-seen status, and Supabase Realtime subscriptions.
- A separate MYGRAM Chat for private/group conversations, media and recorded voice-note bubbles with duration, conversation-scoped Realtime updates, plus slower polling as a fallback.
- Shared online-presence preferences: show/hide online status, green online indicator for permitted chat contacts, and relative last-seen time when visible. Hiding status clears the stored last-seen timestamp; presence records use RLS and are not exposed to anonymous users.
- Community creation, membership, and community posts, protected by row-level security.
- 60 language choices with 47 translated core interface strings per locale; feature-specific labels still need broader localization review.
- Database migrations and RLS policies for social content, private messages, reels, and communities.

## Messenger presence and voice notes

The additive migration `supabase/migrations/20261026010000_add_chat_presence_and_voice_duration.sql` adds `public.user_presence` and `chat_messages.duration_seconds`. The same presence migration was applied to the connected Supabase project and read-only checks confirmed RLS, the own-row update policy, shared-conversation read restrictions, and the hidden-status constraint. Do not manually re-run schema changes against an existing project without checking migration history first.

Presence is refreshed while the signed-in client is active. The UI treats a timestamp within 90 seconds as online, otherwise it renders a relative last-seen time when visible. If the user disables “إظهار حالتي للآخرين”, the client clears `last_seen_at` and other users see no online/last-seen information. Recorded voice notes are limited to ten minutes and are stored as private attachments.

## Deploy and configure

1. Set the Supabase project URL and publishable/anon key in `config.js`. Never put a service-role key in browser code.
2. Apply the SQL migrations in `supabase/migrations/` in filename order to a fresh project. For an existing project, inspect migration history and data before applying any migration manually.
3. In Supabase Auth URL Configuration, set the Site URL to `https://mygram-db.github.io/mygram-app/` and add the deployed login/home URLs to the redirect allow-list.
4. Enable **Phone** under Auth providers and configure an SMS provider before expecting real phone OTP to work. Email confirmation and recovery also depend on the project’s SMTP and redirect settings.
5. Deploy the repository root through GitHub Pages. CI runs Playwright browser tests and JavaScript syntax checks before publishing the main branch.

## Verified vs. still requiring live setup

CI browser tests exercise mocked sign-up/login states, post/comment/reaction flows, friend requests, stories, reels, community flows, Messenger, standalone Chat, and responsive layouts. The Supabase integration smoke test checks that the configured public client can query the public profile interface.

The following still require account/provider setup or real-user end-to-end verification:

- Phone OTP, because Supabase Phone Auth and an SMS provider must be enabled/configured in the project dashboard.
- Production email deliverability, confirmation links, and password-recovery email delivery.
- LiveKit Cloud credentials (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`) and real-device tests before live sessions can broadcast actual audio/video. The authenticated `livekit-token` Edge Function is deployed, but provider secrets are account-specific.
- Cloudflare TURN credentials (`CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_KEY`) for more reliable one-to-one WebRTC calls. The `turn-credentials` Edge Function is deployed; without these secrets calls fall back to STUN-only. Cloudflare currently lists a combined 1,000 GB/month Realtime free tier, then $0.05/GB egress.
- Full human review of translations across every page. The 205 dialing-code entries have been cross-checked against Google libphonenumber territory metadata and the ITU-T E.164 numbering-plan standard; national prefixes remain territory-specific.
- Production abuse controls such as blocking/reporting, moderation workflows, and a notification center.

## Troubleshooting

- If the Supabase client fails to start, confirm `config.js` loads before page scripts and hard-refresh the browser.
- If an upload fails, verify the required migrations, Storage buckets, and bucket policies are present.
- If a new account has no profile, inspect the profile-creation trigger and Supabase Auth logs.
- If email links point to the wrong page, correct the Supabase Auth redirect allow-list and SMTP configuration.

## Demo hardening and provider setup

- The home page checks the Supabase session and redirects visitors without a valid session to `login.html`. The auth screen now opens on account creation by default; returning users can select the sign-in tab. A valid existing session is redirected to the home page.
- Feed reaction choices are hidden by default and can be revealed by pressing and holding the reaction button; clicking it still applies the default Like action, and keyboard users can reveal choices with the standard control.
- Email provider recommendation for the demo: **Brevo Free** is the larger of the compared free daily quotas at 300 sends/day, while Resend Free currently lists 3,000/month and 100/day. This is a provider recommendation only: no provider account, sender domain, SMTP credentials, or Supabase Auth email settings are configured by this repository change.
- Before real confirmation and password-reset email delivery, create a provider account, verify a domain you control, configure SPF/DKIM (and preferably DMARC), then enter the SMTP settings in the Supabase Auth dashboard and test delivery. Never commit SMTP passwords or API keys to this repository or browser code.
- SMS OTP is not free and unlimited across 205 countries from a reputable provider. Provider trial accounts have restrictions; real delivery depends on country support, sender rules, and paid credits. Configure Phone Auth and an SMS provider in Supabase, then test actual delivery per target country before promising availability.
- Password screening should combine strong password length/rate limits with server-side leaked-password protection where available. A client-side privacy-preserving k-anonymity check can be an extra layer, but must never be presented as stronger than a server-enforced control or as a replacement for Supabase Auth protection.

## Telegram-inspired messaging and MYGRAM Meetings (development branch)

The draft feature branch adds shared chat capabilities without merging the separate product surfaces into one confusing inbox:

- **Direct Messenger** remains the one-to-one private-message area.
- **MYGRAM Chat** stays a standalone conversation/group chat.
- **WHATSMYGRAM** keeps its separate chat tables, attachments and interface.
- **Shared chat tools** provide in-conversation search, group topics (thread filtering), moderator-controlled pinned messages, personal saved messages and polls/votes.
- **Meetings** has a dedicated workspace with invite codes, attendance and role tracking, chair transfer with an audit trail, meeting text chat, opt-in transcript rows, per-attendee language preference, and individually scoped minutes.

### Meetings service configuration

The following Supabase Edge Function secrets are required before calling services become available:

- LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET for video rooms and short-lived participant tokens.
- SUPABASE_SERVICE_ROLE_KEY (or the configured Supabase secret-key equivalent) for the server-only minutes function.
- MYGRAM_MEETING_AI_API_URL, MYGRAM_MEETING_AI_API_KEY, and MYGRAM_MEETING_AI_MODEL for an OpenAI-compatible AI endpoint. The currently deployed minutes function may also fall back to the corresponding MYGRAM_TRANSLATION_* secrets.

Do not put any of these keys in client-side JavaScript or commit them to GitHub. Missing secrets deliberately produce a configuration error instead of pretending the feature works. Video and AI minutes still need end-to-end provider tests once secrets are configured.

The browser SpeechRecognition prototype uses the local attendee's microphone when supported by their browser; it is not a server-side recording/diarization service for all remote participants. Minutes are stored per attendee and language. PDF export currently opens a Unicode HTML print view for the attendee to save as PDF; automatic email delivery and stored PDF attachments are not yet implemented.

### Scope and release status

These changes are on the draft feature branch and are **not deployed to GitHub Pages** until the pull request is reviewed, tests pass, and the changes are merged to main. Additive meeting and chat-tool database migrations have been applied to the connected Supabase project. This does not mean the video/AI provider configuration or multi-account production acceptance tests are complete.

Current Telegram-inspired UI features include search, topics, pins, saved messages, polls, role foundations and separate chat/work-meeting experiences. Public channel discovery/subscriptions, bots/Mini Apps, full message scheduling/ephemeral-message controls, and a Secret Chats-style end-to-end-encrypted mode remain future work rather than features to promise as finished.
