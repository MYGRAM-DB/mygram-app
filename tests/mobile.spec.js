const { test, expect } = require('@playwright/test');

test('login screen remains usable on mobile and exposes account creation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login.html');
  await expect(page.locator('.login-shell')).toBeVisible();
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#password')).toBeVisible();
  await expect(page.locator('#submitButton')).toBeVisible();
  await page.locator('#signupTab').click();
  await expect(page.locator('#nameLabel')).toBeVisible();
});
