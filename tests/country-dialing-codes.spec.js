const { test, expect } = require('@playwright/test');

test('NANP territories use the shared E.164 country calling code', async ({ page }) => {
  await page.goto('/login.html');
  await page.locator('#phoneTab').click();
  const catalog = await page.evaluate(() => Object.fromEntries(window.MYGRAM_COUNTRIES.map(c => [c.code, { dial: c.dial, nationalPrefix: c.nationalPrefix }])));
  expect(catalog.DM).toEqual({ dial: '+1', nationalPrefix: '767' });
  expect(catalog.DO).toEqual({ dial: '+1', nationalPrefix: '' });
  expect(catalog.AG).toEqual({ dial: '+1', nationalPrefix: '268' });
  expect(catalog.GG).toEqual({ dial: '+44', nationalPrefix: '1481' });
});
