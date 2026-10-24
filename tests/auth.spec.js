const { test, expect } = require('@playwright/test');

test('login page exposes email and password authentication on desktop and mobile', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#authForm')).toBeVisible();
  await expect(page.locator('#email')).toHaveAttribute('type', 'email');
  await expect(page.locator('#password')).toHaveAttribute('type', 'password');
  await expect(page.locator('#authSubmit')).toBeVisible();
});

test('login page can switch to account creation mode on desktop and mobile', async ({ page }) => {
  await page.goto('/');
  await page.locator('#authMode').click();
  await expect(page.locator('#nameWrap')).toBeVisible();
  await expect(page.locator('#authSubmit')).toHaveText('إنشاء حساب');
  await expect(page.locator('#password')).toHaveAttribute('autocomplete', 'new-password');
  await page.locator('#authMode').click();
  await expect(page.locator('#nameWrap')).toBeHidden();
  await expect(page.locator('#authSubmit')).toHaveText('تسجيل الدخول');
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
