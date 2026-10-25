const { test, expect } = require('@playwright/test');

test('dedicated login page exposes email and password authentication', async ({ page }) => {
  await page.goto('/login.html');
  await expect(page.locator('#authForm')).toBeVisible();
  await expect(page.locator('#email')).toHaveAttribute('type', 'email');
  await expect(page.locator('#password')).toHaveAttribute('type', 'password');
  await expect(page.locator('#submitButton')).toBeVisible();
  await expect(page.locator('#loginTab')).toBeVisible();
});

test('login page defaults to signup and switches cleanly to existing-account login', async ({ page }) => {
  await page.goto('/login.html');
  await expect(page.locator('#nameLabel')).toBeVisible();
  await expect(page.locator('#submitButton')).toHaveText('إنشاء الحساب');
  await expect(page.locator('#password')).toHaveAttribute('autocomplete', 'new-password');
  await page.locator('#loginTab').click();
  await expect(page.locator('#nameLabel')).toBeHidden();
  await expect(page.locator('#submitButton')).toHaveText('تسجيل الدخول');
  await expect(page.locator('#password')).toHaveAttribute('autocomplete', 'current-password');
  await page.locator('#signupTab').click();
  await expect(page.locator('#nameLabel')).toBeVisible();
});

test('root route opens the dedicated login page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/login\.html/);
  await expect(page.locator('#authForm')).toBeVisible();
});

test('signed-out visitor is redirected from the private home page', async ({ page }) => {
  await page.goto('/home.html');
  await expect(page).toHaveURL(/login\.html(?:$|[?#])/);
  await expect(page.locator('#authForm')).toHaveCount(1);
});

for (const route of ['/people.html', '/profile.html', '/services.html']) {
  test(`signed-out visitor cannot access private page ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL(/login\.html(?:$|[?#])/);
    await expect(page.locator('#authForm')).toHaveCount(1);
  });
}
