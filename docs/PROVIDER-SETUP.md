# MYGRAM provider setup (free-first)

This guide separates application code from account-owned provider credentials. Never commit SMTP passwords, API keys, Supabase service-role keys, or LiveKit secrets to the repository or browser JavaScript.

## 1. Free transactional email for Supabase Auth

Recommended first option: **Brevo Free SMTP**. Brevo currently advertises up to 300 emails/day on its free tier. **Resend** is an alternative that advertises 3,000 emails/month and a 100/day limit on its free tier. Provider limits and eligibility can change; verify the current provider pricing pages before launch.

- [Brevo free SMTP and pricing](https://www.brevo.com/free-smtp-server/)
- [Resend pricing](https://resend.com/pricing)
- [Supabase custom SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp)

### Steps

1. Create a free Brevo account.
2. Add a sender domain you control and complete the DNS verification records (SPF/DKIM; configure DMARC for the domain as appropriate). A public free mailbox address is not a substitute for domain verification.
3. In Brevo, open SMTP & API and create/copy the **SMTP key**. Keep it private.
4. In Supabase Dashboard, open **Authentication → SMTP Settings** (the label may vary by dashboard version), enable custom SMTP, and enter:
   - Host: `smtp-relay.brevo.com`
   - Port: `587` with STARTTLS
   - Username: the SMTP login shown by Brevo
   - Password: the generated SMTP key, not your Brevo account password
   - Sender name: `MYGRAM`
   - Sender email: the verified sender address on your domain
5. In **Authentication → URL Configuration**, set the Site URL to `https://mygram-db.github.io/mygram-app/` and add the exact deployed callback URLs used by the app to Redirect URLs.
6. Review the confirmation and password-recovery email templates, save, and use Supabase's test-send facility if available.
7. Test sign-up confirmation and password recovery using an email address outside your Supabase organization. Check inbox, spam, and provider delivery logs.

Until custom SMTP is configured, Supabase's default mailer is restricted and rate-limited, so it is not suitable for public production registration. Do not paste credentials into ChatGPT or put them in `config.js`.

## 2. Phone OTP / SMS

Supabase Phone Auth needs an SMS provider. There is no provider I can responsibly promise will send real production SMS to 205 countries for free forever. Trial balances usually restrict destinations, volume, sender identity, or duration.

- [Supabase phone sign-in and supported providers](https://supabase.com/docs/guides/auth/phone-login)
- [Twilio pricing](https://www.twilio.com/sms/pricing)
- [Vonage SMS pricing](https://www.vonage.com/communications-apis/sms/pricing/)
- [MessageBird/Bird pricing](https://bird.com/pricing)

### Steps when choosing a provider

1. Create a provider account and complete any required business/identity verification.
2. Check the per-country rate table for the countries MYGRAM will support, including sender registration rules. SMS pricing varies by destination and carrier.
3. In Supabase Dashboard, open **Authentication → Providers → Phone**, enable phone sign-in, and select/configure the provider supported by your Supabase project.
4. Add the provider credentials only in the Supabase dashboard's protected provider fields. Never put them in frontend code.
5. Configure rate limits and CAPTCHA/anti-abuse controls, then test OTP delivery to real, consented numbers in each target region.
6. Keep email sign-in available as a no-SMS fallback until production SMS is verified.

If zero ongoing cost is mandatory, email OTP/confirmation is the realistic free-first option. It is not honest to label phone SMS as operational until a provider has been configured and a real SMS has arrived.

## 3. Breached-password screening

The signup and password-reset UI now checks the Have I Been Pwned Pwned Passwords corpus before sending the password to Supabase Auth. It computes SHA-1 locally and sends only the first five hexadecimal characters to the range API, following its k-anonymity design.

- [Official Pwned Passwords API documentation](https://haveibeenpwned.com/API/v3#PwnedPasswords)

This is a useful free additional guard, but it runs in the browser and can be bypassed by a modified client or direct Auth API request. It is **not equivalent to server-enforced leaked-password protection**. Keep Supabase's built-in password policy enabled; use the built-in leaked-password protection when the project plan supports it or move to an auth stack where server-side password screening can be enforced.

## 4. Free-first audio/video calls

MYGRAM Chat now has one-to-one WebRTC audio/video call controls and RLS-protected, expiring call-signaling records in Supabase. Media flows peer-to-peer; Supabase stores only short-lived signaling data, not call audio/video.

- One-to-one calls in standalone Chat use peer-to-peer WebRTC and do not require provider keys, but some networks need a TURN relay.
- For more reliable one-to-one calls across restrictive NAT/firewall networks, MYGRAM can obtain short-lived Cloudflare Realtime TURN credentials through the authenticated Supabase Edge Function `turn-credentials`. Create a TURN key in Cloudflare, then add `CLOUDFLARE_TURN_KEY_ID` (the key UID) and `CLOUDFLARE_TURN_KEY` (the secret key value) under Supabase Dashboard → Edge Functions → Secrets. Never put the TURN key in browser code. Cloudflare currently lists a 1,000 GB/month combined Realtime free tier and $0.05/GB egress beyond it; monitor usage and billing. [Official TURN credential guide](https://developers.cloudflare.com/realtime/turn/generate-credentials/) and [pricing](https://developers.cloudflare.com/realtime/sfu/platform/pricing/).
- Live-session cards now connect to LiveKit through the deployed, authenticated Supabase Edge Function `livekit-token`. To activate broadcast, create a LiveKit Cloud project and set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` under Supabase Dashboard → Edge Functions → Secrets. The function checks the authenticated user and host/viewer role before minting a short-lived room token.
- The LiveKit Cloud free quota can change and is not unlimited forever. For self-hosting, the [LiveKit server is open source](https://docs.livekit.io/transport/self-hosting/), but a reliable public server still needs hosting and bandwidth.
- Do not expose LiveKit secrets in `services.js`, `chat.js`, or any other browser asset.

## 5. Validation checklist

- [ ] Confirm sender-domain DNS verification and test a real confirmation email.
- [ ] Test password-recovery email and redirect on the deployed domain.
- [ ] Enable/configure an SMS provider and test real OTP delivery in supported regions.
- [ ] Test audio/video calls between two real devices on different networks.
- [ ] Test a network that requires TURN; configure a relay before claiming universal call connectivity.
- [ ] Review Supabase Auth rate limits, CAPTCHA, RLS policies, and provider delivery logs.
