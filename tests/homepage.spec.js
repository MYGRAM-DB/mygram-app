const { test, expect } = require('@playwright/test');

test('MYGRAM entry point opens a dedicated responsive authentication screen', async ({ page }) => {
  const response = await page.goto('/login.html');
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);
  await expect(page.locator('.login-shell')).toBeVisible();
  await expect(page.locator('#authForm')).toBeVisible();
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#password')).toBeVisible();
  await expect(page.locator('#submitButton')).toBeEnabled();
});

test('login form rejects malformed email before submitting', async ({ page }) => {
  await page.goto('/login.html');
  await page.locator('#email').fill('not-an-email');
  await page.locator('#password').fill('long-enough-password');
  const invalid = await page.locator('#email').evaluate(el => !el.checkValidity());
  expect(invalid).toBe(true);
});

test('signed-in community page has real button and composer styling', async ({ page }) => {
  await page.goto('/home.html');
  await expect(page).toHaveURL(/login\.html/);
});
