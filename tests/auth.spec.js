const { test, expect } = require('@playwright/test');

test('login page exposes email and password authentication', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'chromium-mobile', 'The login card is not visible in the current mobile feed layout.');
  await page.goto('/');
  await expect(page.locator('#authForm')).toBeVisible();
  await expect(page.locator('#email')).toHaveAttribute('type', 'email');
  await expect(page.locator('#password')).toHaveAttribute('type', 'password');
  await expect(page.locator('#authSubmit')).toBeVisible();
});

test('login page can switch to account creation mode', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'chromium-mobile', 'The login card is not visible in the current mobile feed layout.');
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

// These pages are public informational placeholders and do not display private user data yet.
test('people placeholder explains that member records are not connected', async ({ page }) => {
  await page.goto('/people.html');
  await expect(page.getByRole('heading', { name: 'اكتشف مجتمع MYGRAM' })).toBeVisible();
  await expect(page.getByText(/قائمة الأعضاء الفعلية تحتاج قراءة آمنة/)).toBeVisible();
});

test('profile placeholder explains that profile data is not connected', async ({ page }) => {
  await page.goto('/profile.html');
  await expect(page.getByRole('heading', { name: 'الملف الشخصي' })).toBeVisible();
  await expect(page.getByText(/تظهر معلومات الحساب بعد تسجيل الدخول/)).toBeVisible();
});

test('services placeholder renders its public informational content', async ({ page }) => {
  await page.goto('/services.html');
  await expect(page.getByRole('heading', { name: 'خدمات مجتمعك' })).toBeVisible();
  await expect(page.getByText(/الخدمات التي تحتاج جداول وسياسات غير موجودة/)).toBeVisible();
});
