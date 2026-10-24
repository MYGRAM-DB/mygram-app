const { test, expect } = require('@playwright/test');

test('login page exposes email and password authentication', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'chromium-mobile', 'Login form is not displayed in the mobile feed layout.');
  await page.goto('/');
  await expect(page.locator('#authForm')).toBeVisible();
  await expect(page.locator('#email')).toHaveAttribute('type', 'email');
  await expect(page.locator('#password')).toHaveAttribute('type', 'password');
  await expect(page.locator('#authSubmit')).toBeVisible();
});

test('login page can switch to account creation mode', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'chromium-mobile', 'Login form is not displayed in the mobile feed layout.');
  await page.goto('/');
  await page.locator('#authMode').click();
  await expect(page.locator('#nameWrap')).toBeVisible();
  await expect(page.locator('#authSubmit')).toHaveText('إنشاء حساب');
});

test('signed-out visitor is redirected from the private home page', async ({ page }) => {
  await page.goto('/home.html');
  await expect(page).toHaveURL(/index\.html(?:$|[?#])/);
  await expect(page.locator('#authForm')).toHaveCount(1);
});

for (const route of ['/people.html', '/profile.html', '/services.html']) {
  test(`signed-out visitor cannot access private page ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL(/index\.html(?:$|[?#])/);
    await expect(page.locator('#authForm')).toHaveCount(1);
  });
}
