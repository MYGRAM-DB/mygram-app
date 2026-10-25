import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { collectUiCatalog, getAppLocales } from "./locale-utils.mjs";

const root = process.cwd();
const catalog = await collectUiCatalog();
const locales = (await getAppLocales()).filter((locale) => locale !== "ar");
const manifest = JSON.parse(await readFile(join(root, "locales", "manifest.json"), "utf8"));
if (manifest.generated !== true) throw new Error("Locale manifest is not marked generated. Run npm run translate:locales first.");
const missingLocales = locales.filter((locale) => !manifest.available.includes(locale));
if (missingLocales.length) throw new Error(`Manifest is missing locales: ${missingLocales.join(", ")}`);

let missing = 0;
let untranslatedArabic = 0;
let missingPlaceholders = 0;
for (const locale of locales) {
  const translations = JSON.parse(await readFile(join(root, "locales", `${locale}.json`), "utf8"));
  for (const item of catalog) {
    const value = translations[item.raw];
    if (typeof value !== "string" || !value.trim()) {
      missing++;
      console.error(`Missing ${locale}: ${item.raw}`);
      continue;
    }
    if (item.from === "ar" && value.trim() === item.raw.trim()) {
      untranslatedArabic++;
      console.error(`Untranslated Arabic source in ${locale}: ${item.raw}`);
    }
    for (const placeholder of item.placeholders) {
      if (!value.includes(placeholder)) {
        missingPlaceholders++;
        console.error(`Placeholder ${placeholder} missing in ${locale}: ${item.raw}`);
      }
    }
  }
}
if (missing || untranslatedArabic || missingPlaceholders) {
  throw new Error(`Locale check failed: ${missing} missing, ${untranslatedArabic} untranslated Arabic, ${missingPlaceholders} missing placeholders.`);
}
console.log(`Locale coverage verified: ${catalog.length} extra strings × ${locales.length} locales, with placeholders preserved.`);
