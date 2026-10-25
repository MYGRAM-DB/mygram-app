const { test, expect } = require('@playwright/test');

test('country picker registry contains 205 unique territories with calling codes', async ({ page }) => {
  await page.goto('/login.html');
  const registry = await page.evaluate(() => (window.MYGRAM_COUNTRIES || []).map(country => ({
    code: country.code,
    dial: country.dial,
    name: country.name,
  })));
  expect(registry).toHaveLength(205);
  expect(new Set(registry.map(country => country.code)).size).toBe(205);
  expect(registry.every(country => /^[A-Z]{2}$/.test(country.code))).toBeTruthy();
  expect(registry.every(country => /^\+[0-9]{1,4}$/.test(country.dial))).toBeTruthy();
  expect(registry.every(country => country.name && country.name !== country.code)).toBeTruthy();
});
