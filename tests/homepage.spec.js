const { test, expect } = require('@playwright/test');

test('MYGRAM homepage renders its real authentication and community interface', async ({ page }) => {
  const response = await page.goto('/');
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);
  await expect(page.locator('body')).not.toBeEmpty();
  await expect(page.locator('#authForm')).toBeVisible();
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#password')).toBeVisible();
  await expect(page.locator('#postsList')).toBeVisible();
  await expect(page.locator('#authSubmit')).toBeEnabled();
});

test('login form rejects malformed email before submitting', async ({ page }) => {
  await page.goto('/');
  await page.locator('#email').fill('not-an-email');
  await page.locator('#password').fill('long-enough-password');
  const invalid = await page.locator('#email').evaluate(el => !el.checkValidity());
  expect(invalid).toBe(true);
});
