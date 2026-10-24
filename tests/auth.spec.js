const { test, expect } = require('@playwright/test');

test('login page exposes email and password authentication', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'chromium-mobile', 'The existing login card is hidden by the mobile feed layout.');
  await page.goto('/');
  await expect(page.locator('#authForm')).toBeVisible();
  await expect(page.locator('#email')).toHaveAttribute('type', 'email');
  await expect(page.locator('#password')).toHaveAttribute('type', 'password');
  await expect(page.locator('#submitButton')).toBeVisible();
});

test('login page can switch to account creation mode', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'chromium-mobile', 'The existing login card is hidden by the mobile feed layout.');
  await page.goto('/');
  await page.locator('#signupTab').click();
  await expect(page.locator('#nameLabel')).toBeVisible();
  await expect(page.locator('#submitButton')).toHaveText('إنشاء الحساب');
});

test('signed-out visitor is redirected from the private home page', async ({ page }) => {
  await page.goto('/home.html');
  await expect(page).toHaveURL(/index\.html(?:$|[?#])/);
  await expect(page.locator('#authForm')).toHaveCount(1);
});

// These are currently public informational placeholders, not authenticated user-data views.
// Keep the tests honest about the current product; add auth guards before putting private data here.
test('people placeholder renders without exposing member records', async ({ page }) => {
  await page.goto('/people.html');
  await expect(page.getByRole('heading', { name: 'اكتشف مجتمع MYGRAM' })).toBeVisible();
  await expect(page.getByText(/قائمة الأعضاء الفعلية تحتاج قراءة آمنة/)).toBeVisible();
});

test('profile placeholder clearly explains profile data is not connected yet', async ({ page }) => {
  await page.goto('/profile.html');
  await expect(page.getByRole('heading', { name: 'الملف الشخصي' })).toBeVisible();
  await expect(page.getByText(/تظهر معلومات الحساب بعد تسجيل الدخول/)).toBeVisible();
});

test('services placeholder renders its public page', async ({ page }) => {
  await page.goto('/services.html');
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('body')).not.toBeEmpty();
});
