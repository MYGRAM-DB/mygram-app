const { test, expect } = require('@playwright/test');

test('anonymous Supabase client cannot read private profiles', async ({ page }) => {
  await page.goto('/login.html');
  await page.waitForFunction(() => Boolean(window.supabase && window.MYGRAM_CONFIG?.supabaseUrl && window.MYGRAM_CONFIG?.supabaseKey));
  const result = await page.evaluate(async () => {
    const client = window.supabase.createClient(
      window.MYGRAM_CONFIG.supabaseUrl,
      window.MYGRAM_CONFIG.supabaseKey,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
    );
    const { data, error } = await client.from('profiles').select('id').limit(1);
    return { data, error: error ? { message: error.message, code: error.code } : null };
  });
  expect(result.error).not.toBeNull();
  expect(result.error.code).toBe('42501');
  expect(result.data).toBeNull();
});
