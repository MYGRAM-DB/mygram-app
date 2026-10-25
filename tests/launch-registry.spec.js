const { test, expect } = require('@playwright/test');

test('beta registries and core translation catalog are complete in Supabase', async ({ page }) => {
  await page.goto('/login.html');
  await page.waitForFunction(() => Boolean(window.supabase && window.MYGRAM_CONFIG?.supabaseUrl && window.MYGRAM_CONFIG?.supabaseKey));

  const result = await page.evaluate(async () => {
    const client = window.supabase.createClient(
      window.MYGRAM_CONFIG.supabaseUrl,
      window.MYGRAM_CONFIG.supabaseKey,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
    );

    const [locales, countries] = await Promise.all([
      client.from('supported_locales').select('code,enabled').eq('enabled', true),
      client.from('supported_countries').select('code,calling_code,enabled').eq('enabled', true)
    ]);
    if (locales.error) return { error: 'locales: ' + locales.error.message };
    if (countries.error) return { error: 'countries: ' + countries.error.message };

    const translations = [];
    for (const [from, to] of [[0, 999], [1000, 1999], [2000, 2999]]) {
      const pageResult = await client.from('translation_catalog')
        .select('target_locale,status')
        .eq('status', 'approved')
        .order('target_locale')
        .range(from, to);
      if (pageResult.error) return { error: 'translations: ' + pageResult.error.message };
      translations.push(...(pageResult.data || []));
    }

    const perLocale = {};
    for (const row of translations) perLocale[row.target_locale] = (perLocale[row.target_locale] || 0) + 1;
    return {
      localeCount: locales.data.length,
      countryCount: countries.data.length,
      countryCodesUnique: new Set(countries.data.map(row => row.code)).size,
      localesUnique: new Set(locales.data.map(row => row.code)).size,
      translationCount: translations.length,
      perLocale,
      translationError: null
    };
  });

  expect(result.error).toBeUndefined();
  expect(result.localeCount).toBe(60);
  expect(result.localesUnique).toBe(60);
  expect(result.countryCount).toBe(205);
  expect(result.countryCodesUnique).toBe(205);
  expect(result.translationCount).toBe(2820);
  expect(Object.keys(result.perLocale)).toHaveLength(60);
  for (const [locale, count] of Object.entries(result.perLocale)) {
    expect(count, 'approved core translation count for ' + locale).toBe(47);
  }
});
