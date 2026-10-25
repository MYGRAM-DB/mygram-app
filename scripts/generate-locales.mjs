import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { azureLanguageCode, collectUiCatalog, getAppLocales, protectPlaceholders } from "./locale-utils.mjs";

const key = process.env.AZURE_TRANSLATOR_KEY;
const region = process.env.AZURE_TRANSLATOR_REGION;
if (!key || !region) {
  throw new Error("Set AZURE_TRANSLATOR_KEY and AZURE_TRANSLATOR_REGION. Use an Azure Translator F0 resource; never commit the key.");
}

const locales = await getAppLocales();
const catalog = await collectUiCatalog();
if (!catalog.length) throw new Error("No additional Arabic UI strings were found to translate.");
const supportedResponse = await fetch("https://api.cognitive.microsofttranslator.com/languages?api-version=3.0&scope=translation");
if (!supportedResponse.ok) throw new Error(`Could not load supported translation languages: HTTP ${supportedResponse.status}`);
const supported = await supportedResponse.json();
const supportedCodes = new Set(Object.keys(supported.translation || {}));
const unsupported = locales.filter((code) => code !== "ar" && !supportedCodes.has(azureLanguageCode(code)));
if (unsupported.length) throw new Error(`Azure Translator does not list these app locales: ${unsupported.join(", ")}. Add explicit provider mappings before generating.`);

const apiTargets = locales.filter((code) => code !== "ar");
const estimatedBillableCharacters = catalog.reduce((sum, item) => {
  const targetCount = apiTargets.filter((target) => !(target === "en" && item.from === "en")).length;
  return sum + item.sourceText.length * targetCount;
}, 0);
const freeTierGuard = 1_800_000;
if (estimatedBillableCharacters > freeTierGuard && process.env.ALLOW_PAID_TRANSLATION !== "1") {
  throw new Error(`Estimated ${estimatedBillableCharacters.toLocaleString()} billable characters exceed the ${freeTierGuard.toLocaleString()}-character safety guard. Reduce the catalog or explicitly set ALLOW_PAID_TRANSLATION=1 after reviewing pricing.`);
}

const outputDir = join(process.cwd(), "locales");
await mkdir(outputDir, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function translateBatch(items, target, sourceLanguage) {
  const protectedItems = items.map((item) => ({ item, protected: protectPlaceholders(item.sourceText, item.placeholders) }));
  const params = new URLSearchParams({ "api-version": "3.0", from: sourceLanguage, to: azureLanguageCode(target) });
  const url = "https://api.cognitive.microsofttranslator.com/translate?" + params.toString();
  let lastError;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Ocp-Apim-Subscription-Region": region,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify(protectedItems.map(({ protected: value }) => ({ Text: value.text }))),
      });
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 500);
        throw new Error(`Azure Translator HTTP ${response.status}: ${detail}`);
      }
      const results = await response.json();
      if (!Array.isArray(results) || results.length !== protectedItems.length) {
        throw new Error("Azure Translator returned an unexpected response length.");
      }
      return results.map((result, index) => {
        const text = result?.translations?.[0]?.text;
        if (typeof text !== "string" || !text.trim()) throw new Error("Azure Translator returned an empty translation.");
        return protectedItems[index].protected.restore(text.trim());
      });
    } catch (error) {
      lastError = error;
      if (attempt === 3) break;
      await sleep(500 * (2 ** attempt));
    }
  }
  throw lastError;
}

async function translateLocale(locale) {
  const translated = {};
  for (const sourceLanguage of ["en", "ar"]) {
    const items = catalog.filter((item) => item.from === sourceLanguage);
    const pending = locale === "en" && sourceLanguage === "en" ? [] : items;
    for (let start = 0; start < pending.length; start += 100) {
      const batch = pending.slice(start, start + 100);
      const values = await translateBatch(batch, locale, sourceLanguage);
      batch.forEach((item, index) => { translated[item.raw] = values[index]; });
    }
    if (locale === "en" && sourceLanguage === "en") {
      items.forEach((item) => { translated[item.raw] = item.sourceText; });
    }
  }
  return translated;
}

for (const locale of locales) {
  if (locale === "ar") continue;
  const translations = await translateLocale(locale);
  await writeFile(join(outputDir, `${locale}.json`), JSON.stringify(translations, null, 2) + "\n", "utf8");
  console.log(`Generated ${locale}: ${Object.keys(translations).length} strings`);
}

const manifest = {
  version: 1,
  generated: true,
  provider: "Azure Translator F0 / v3.0",
  generatedAt: new Date().toISOString(),
  sourceCount: catalog.length,
  available: locales.filter((locale) => locale !== "ar"),
  estimatedBillableCharacters,
};
await writeFile(join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(`Generated ${locales.length - 1} locale catalogs for ${catalog.length} additional UI strings; estimated billable characters: ${estimatedBillableCharacters.toLocaleString()}.`);
