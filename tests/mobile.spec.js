const { test, expect } = require('@playwright/test');

test('protected home redirects signed-out visitors to login', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/home.html');
  await expect(page).toHaveURL(/index\.html(?:$|[?#])/);
  await expect(page.locator('#authForm')).toBeVisible();
});
