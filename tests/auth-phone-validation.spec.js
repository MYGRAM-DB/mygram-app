const { test, expect } = require('@playwright/test');

test('phone registration stays unavailable until its provider is configured', async ({ page }) => {
  await page.goto('/login.html');
  await expect(page.locator('#phoneTab')).toBeHidden();
  await expect(page.locator('#phoneCountryLabel')).toBeHidden();
  await expect(page.locator('#phoneLabel')).toBeHidden();
  // Do not pretend live OTP is available: Supabase Phone Auth and an SMS provider
  // have not been configured for this project yet.
});

test('country calling-code catalog contains 205 unique supported entries', async ({ page }) => {
  await page.goto('/login.html');
  const catalog = await page.evaluate(() => window.MYGRAM_COUNTRIES.map(c => ({ code: c.code, dial: c.dial, nationalPrefix: c.nationalPrefix })));
  expect(catalog).toHaveLength(205);
  expect(new Set(catalog.map(c => c.code)).size).toBe(205);
  expect(catalog.every(c => /^\+[0-9]+$/.test(c.dial))).toBe(true);
  const byCode = Object.fromEntries(catalog.map(c => [c.code, c.dial]));
  expect(byCode.US).toBe('+1');
  expect(byCode.NL).toBe('+31');
  expect(byCode.GB).toBe('+44');
  expect(byCode.IN).toBe('+91');
  expect(byCode.JP).toBe('+81');
  expect(byCode.GG).toBe('+44');
  expect(catalog.find(c => c.code === 'GG').nationalPrefix).toBe('1481');
  expect(byCode.AG).toBe('+1');
  expect(catalog.find(c => c.code === 'AG').nationalPrefix).toBe('268');
});

test('password policy changes by auth mode without blocking existing logins', async ({ page }) => {
  await page.goto('/login.html');
  const password = page.locator('#password');
  await expect(password).toHaveAttribute('minlength', '8');
  await expect(password).toHaveAttribute('placeholder', '8 أحرف على الأقل');
  await page.locator('#loginTab').click();
  await expect(password).toHaveAttribute('minlength', '1');
  await expect(password).toHaveAttribute('autocomplete', 'current-password');
  await page.locator('#signupTab').click();
  await expect(password).toHaveAttribute('minlength', '8');
});
