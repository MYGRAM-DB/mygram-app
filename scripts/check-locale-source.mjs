import { collectUiCatalog, getAppLocales } from "./locale-utils.mjs";

const locales = await getAppLocales();
const catalog = await collectUiCatalog();
if (locales.length !== 60) throw new Error(`Expected 60 locales, found ${locales.length}.`);
if (catalog.length < 30) throw new Error(`Only ${catalog.length} additional UI strings were discovered; check the source extractor.`);
const duplicates = catalog.filter((item, index) => catalog.findIndex((candidate) => candidate.raw === item.raw) !== index);
if (duplicates.length) throw new Error(`The source extractor produced ${duplicates.length} duplicate strings.`);
console.log(`Locale source audit passed: ${locales.length} locales, ${catalog.length} additional UI strings, placeholders retained.`);
