import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const LANGUAGE_FILE = join(ROOT, "language.js");
const EXCLUDED = new Set(["language.js", "country-data.js", "config.js", "service-worker.js"]);

export async function getLanguageSource() {
  return readFile(LANGUAGE_FILE, "utf8");
}

export async function getAppLocales() {
  const source = await getLanguageSource();
  const codes = [...source.matchAll(/<option value="([a-z]{2,3})">/g)].map((match) => match[1]);
  const unique = [...new Set(codes)].filter((code) => /^[a-z]{2,3}$/.test(code));
  if (unique.length !== 60) {
    throw new Error(`Expected exactly 60 locale options in language.js, found ${unique.length}.`);
  }
  return unique;
}

export function azureLanguageCode(code) {
  return ({ zh: "zh-Hans", no: "nb", sr: "sr-Cyrl" })[code] || code;
}

function parseObject(source, expression, label) {
  const match = source.match(expression);
  if (!match) throw new Error(`Could not locate ${label} in language.js.`);
  try {
    return Function(`"use strict"; return (${match[1]});`)();
  } catch (error) {
    throw new Error(`Could not parse ${label}: ${error.message}`);
  }
}

function decodeLiteral(value) {
  return value.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t");
}

function extractTextCandidates(source) {
  const result = [];
  const literal = /"((?:\\.|[^"\\]){2,300})"|'((?:\\.|[^'\\]){2,300})'|`((?:\\.|[^`\\]){2,300})`/gs;
  for (const match of source.matchAll(literal)) {
    const value = match[1] ?? match[2] ?? match[3] ?? "";
    if (!value.includes("\n") && !value.includes("${")) result.push(decodeLiteral(value));
  }
  for (const match of source.matchAll(/>([^<>\n]{2,300})</g)) result.push(match[1]);
  for (const match of source.matchAll(/(?:placeholder|title|aria-label|alt)\s*=\s*["']([^"']{2,300})["']/g)) result.push(match[1]);
  return result;
}

export async function collectUiCatalog() {
  const languageSource = await getLanguageSource();
  const tStart = languageSource.indexOf("const T=") + "const T=".length;
  const tEnd = languageSource.indexOf("};", tStart) + 1;
  if (tStart < "const T=".length || tEnd <= tStart) throw new Error("Could not locate the base locale dictionaries.");
  const baseT = Function(`"use strict"; return (${languageSource.slice(tStart, tEnd)});`)();
  const fallback = parseObject(languageSource, /const englishFallback=(\{.*?\});/s, "englishFallback");
  const coreArabic = new Set([...Object.values(baseT.ar || {}), ...Object.keys(baseT.en || {}), ...Object.keys(baseT.fr || {})]);
  const candidates = new Set(Object.keys(fallback));
  const entries = await readdir(ROOT, { withFileTypes: true });
  const sourceFiles = entries
    .filter((entry) => entry.isFile() && /\.(?:html|js)$/.test(entry.name) && !EXCLUDED.has(entry.name))
    .map((entry) => entry.name);

  for (const file of sourceFiles) {
    const content = await readFile(join(ROOT, file), "utf8");
    for (const value of extractTextCandidates(content)) candidates.add(value);
  }

  const arabicPattern = /[\u0600-\u06ff]/;
  const catalog = [];
  for (const candidate of candidates) {
    const raw = String(candidate).replace(/\s+/g, " ").trim();
    if (raw.length < 2 || raw.length > 240 || !arabicPattern.test(raw) || coreArabic.has(raw)) continue;
    if (/[<>]/.test(raw) || raw.includes("://") || raw.includes("${") || /^\W+$/.test(raw)) continue;
    const english = fallback[raw] || baseT.en?.[raw] || raw;
    const from = arabicPattern.test(english) ? "ar" : "en";
    const placeholders = [...raw.matchAll(/\{\{[^{}]+\}\}|\$\{[^}]+\}|\{[A-Za-z0-9_.-]+\}|%[sdif]|MYGRAM/g)].map((match) => match[0]);
    catalog.push({ raw, sourceText: english, from, placeholders: [...new Set(placeholders)] });
  }
  catalog.sort((a, b) => a.raw.localeCompare(b.raw));
  return catalog;
}

export function protectPlaceholders(text, placeholders) {
  let protectedText = text;
  const replacements = [];
  for (const placeholder of placeholders) {
    const token = `ZZMYGRAMTOKEN${replacements.length}ZZ`;
    protectedText = protectedText.split(placeholder).join(token);
    replacements.push({ token, placeholder });
  }
  return {
    text: protectedText,
    restore(translated) {
      let result = translated;
      for (const { token, placeholder } of replacements) {
        if (!result.includes(token)) throw new Error(`Translator changed a protected placeholder: ${placeholder}`);
        result = result.split(token).join(placeholder);
      }
      return result;
    },
  };
}
