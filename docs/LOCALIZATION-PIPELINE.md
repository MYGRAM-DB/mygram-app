# MYGRAM localization catalog generation

MYGRAM keeps the existing reviewed 47-key core catalog for each of its 60 interface languages. This pipeline fills the feature-specific UI strings, labels, accessibility text, and fixed error/status messages by translating **source-code strings only**. It never submits user posts, messages, profile data, passwords, or other runtime user content to a translation service.

## Free provider

Use [Azure Translator F0 pricing](https://azure.microsoft.com/en-ca/pricing/details/translator/), which currently lists 2 million characters per month free. The free tier is subscription-limited and should be monitored; the generator estimates usage and refuses to proceed above 1.8 million billable characters unless you explicitly override the guard. The API request format follows the [official Translator v3.0 reference](https://learn.microsoft.com/en-us/azure/ai-services/translator/text-translation/reference/v3/translate).

## One-time setup

1. Create an Azure Translator resource using the **F0 (Free)** tier.
2. Copy its key and region from **Keys and Endpoint**.
3. In the GitHub repository settings, add Actions secrets named `AZURE_TRANSLATOR_KEY` and `AZURE_TRANSLATOR_REGION`. Never place these values in source code or chat.
4. Open **Actions → Generate 60-language UI catalogs → Run workflow**.
5. The workflow generates static JSON catalogs, checks coverage/placeholders, and opens a pull request. Review the PR before merging. The deployed site then loads each selected locale's static catalog; it does not call Azure at runtime.

## Local use

```bash
AZURE_TRANSLATOR_KEY=... AZURE_TRANSLATOR_REGION=... npm run translate:locales
npm run check:locales
```

The generator verifies that the provider supports all app locale codes, protects placeholders and the MYGRAM brand, batches requests, retries transient errors, and writes the manifest last so the site never loads a partial set. Arabic remains the source-language interface and does not need a generated catalog. Machine translations still need native-speaker review before being described as human-reviewed.
