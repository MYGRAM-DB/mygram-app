const { test, expect } = require('@playwright/test');

test('MYGRAM mobile home layout fits a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto('/home.html');

  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);

  await expect(page.locator('body')).not.toBeEmpty();
  await expect(page.locator('.mobile-nav')).toBeVisible();
  await expect(page.locator('.mobile-nav a[aria-label="الرئيسية"]')).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth
  }));

  expect(
    dimensions.documentWidth,
    `Horizontal overflow: viewport=${dimensions.viewportWidth}px, document=${dimensions.documentWidth}px`
  ).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
});
