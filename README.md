# MYGRAM

MYGRAM is a static HTML/CSS/JavaScript social platform deployed with GitHub Pages and backed by Supabase Auth, Postgres, and Storage.

## Implemented in the repository

- Email/password sign-in, sign-up, password recovery UI, session guards, and profile creation.
- Phone-number formatting/validation and a 205-country calling-code catalog. Real SMS OTP requires enabling Supabase Phone Auth and configuring an SMS provider.
- Profile editing, avatar/cover media, country/language preferences, member discovery, and friend requests.
- Feed posts, image/video attachments, comments, and eight reaction types.
- Stories with expiry filtering and owner deletion.
- Reels with video publishing, emoji reactions, comments, and owner deletion.
- Direct Messenger with text, image/video/audio attachments, microphone voice recording, and Supabase Realtime subscriptions.
- A separate MYGRAM Chat for private/group conversations, media and recorded voice notes, conversation-scoped Realtime updates, plus slower polling as a fallback.
- Community creation, membership, and community posts, protected by row-level security.
- 60 language choices with 47 translated core interface strings per locale; feature-specific labels still need broader localization review.
- Database migrations and RLS policies for social content, private messages, reels, and communities.

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
- A real external live-streaming provider. The current live-session feature creates scheduling/session records; it is not a production live-video broadcast.
- Full human review of translations across every page, and authoritative validation of all 205 calling codes against an up-to-date numbering-plan source.
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
