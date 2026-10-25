const { test, expect } = require('@playwright/test');

test('Supabase public client reads public locales while private profiles stay inaccessible', async ({ page }) => {
  await page.goto('/login.html');
  await page.waitForFunction(() => Boolean(window.supabase && window.MYGRAM_CONFIG?.supabaseUrl && window.MYGRAM_CONFIG?.supabaseKey));
  const result = await page.evaluate(async () => {
    const client = window.supabase.createClient(
      window.MYGRAM_CONFIG.supabaseUrl,
      window.MYGRAM_CONFIG.supabaseKey,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
    );
    const [{ data: locales, error: localeError }, { data: profiles, error: profileError }] = await Promise.all([
      client.from('supported_locales').select('code').limit(1),
      client.from('profiles').select('id').limit(1)
    ]);
    return {
      locales,
      localeError: localeError ? { message: localeError.message, code: localeError.code } : null,
      profiles,
      profileError: profileError ? { message: profileError.message, code: profileError.code } : null
    };
  });
  expect(result.localeError).toBeNull();
  expect(Array.isArray(result.locales)).toBe(true);
  expect(result.profileError?.code).toBe('42501');
});
