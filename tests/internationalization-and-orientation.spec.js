const { test, expect } = require('@playwright/test');

test('language picker is available on login and supports the currently implemented locales', async ({ page }) => {
  await page.goto('/login.html');
  const picker = page.locator('#mygramLanguage');
  await expect(picker).toBeVisible();
  await expect(picker.locator('option')).toHaveCount(31);
  await picker.selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await picker.selectOption('ar');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('login remains usable in portrait and landscape mobile orientations', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login.html');
  await expect(page.locator('#authForm')).toBeVisible();
  await expect(page.locator('#submitButton')).toBeVisible();

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('#authForm')).toBeVisible();
  await expect(page.locator('#submitButton')).toBeVisible();
  const bounds = await page.locator('#submitButton').boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(844);
});

test('password recovery action is visible and does not submit the login form', async ({ page }) => {
  await page.goto('/login.html');
  const recovery = page.locator('#resetPasswordButton');
  await expect(recovery).toBeVisible();
  await expect(recovery).toHaveAttribute('type', 'button');
});

test('Spanish locale translates core navigation and uses left-to-right layout', async ({ page }) => {
  await page.goto('/login.html');
  const picker = page.locator('#mygramLanguage');
  await picker.selectOption('es');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('#formTitle')).toContainText('Iniciar sesión');
  await picker.selectOption('zh');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh');
  await picker.selectOption('ur');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ur');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await picker.selectOption('uk');
  await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
});
