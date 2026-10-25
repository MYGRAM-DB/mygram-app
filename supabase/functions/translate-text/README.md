# MYGRAM translation service setup

The `translate-text` Supabase Edge Function is deployed with JWT verification enabled. It supports authenticated, batched translation requests for enabled locale codes, caches successful results for 30 days, and applies a per-user hourly quota.

## Required Edge Function secrets

Configure these under Supabase Edge Function secrets. Never commit them to GitHub or send them in chat.

- `MYGRAM_TRANSLATION_API_URL`: HTTPS endpoint compatible with the OpenAI Chat Completions request/response format.
- `MYGRAM_TRANSLATION_API_KEY`: server-side provider key.
- `MYGRAM_TRANSLATION_MODEL`: model identifier supported by that endpoint.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`: supplied by Supabase for Edge Functions; if the environment does not provide them automatically, add them through the Supabase secrets UI. The service-role key must remain server-side only.

The current function returns HTTP 503 when the provider secrets are missing. A successful deployment alone does not mean AI translation is operational; test it after setting secrets.

## Request

Send an authenticated POST to the deployed `translate-text` function with a JSON body:

```json
{
  "sourceLocale": "auto",
  "targetLocale": "fr",
  "items": [
    { "key": "welcome", "text": "Welcome back" },
    { "key": "send", "text": "Send" }
  ]
}
```

The function accepts up to 80 keyed strings per request, each up to 1,000 characters, and at most 12,000 total input characters. It preserves keys and asks the provider to preserve placeholders and markup. The authenticated user is limited to 30 cache-miss requests per hour by the database quota function. Cache hits do not call the provider.

## Translation quality and locale catalog

The database currently contains 60 enabled locales with 47 approved catalog entries per locale (2,820 entries total). This is a useful core catalog, not proof that every feature-specific string has been professionally translated. Review the complete UI and feature-specific strings in each locale before public launch. Machine-generated text must not be marked approved automatically.

## Locale and region detection

The browser language and region inferred from locale tags are approximate signals, not verified nationality or precise location. Users should be able to override them. Do not request GPS or infer sensitive location without explicit consent. Country/nationality selection remains user-controlled.
