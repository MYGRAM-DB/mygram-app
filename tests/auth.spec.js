const { test, expect } = require('@playwright/test');

test('dedicated login page exposes email and password authentication', async ({ page }) => {
  await page.goto('/login.html');
  await expect(page.locator('#authForm')).toBeVisible();
  await expect(page.locator('#email')).toHaveAttribute('type', 'email');
  await expect(page.locator('#password')).toHaveAttribute('type', 'password');
  await expect(page.locator('#submitButton')).toBeVisible();
  await expect(page.locator('#loginTab')).toBeVisible();
  await expect(page.locator('#googleSignInButton')).toBeVisible();
  await expect(page.locator('#googleSignInButton')).toHaveAttribute('type', 'button');
  await page.locator('#loginTab').click();
  await expect(page.locator('#magicLinkButton')).toBeVisible();
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


test('email magic-link login never creates a new account', async ({ page }) => {
  let otpBody = null;
  await page.route('**/auth/v1/otp**', async route => {
    otpBody = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"message_id":"mock-magic-link"}' });
  });
  await page.goto('/login.html');
  await page.locator('#loginTab').click();
  await page.locator('#email').fill('existing-user@example.test');
  await page.locator('#magicLinkButton').click();
  await expect(page.locator('#authNotice')).toContainText('ستصلك رسالة دخول');
  expect(otpBody).toBeTruthy();
  expect(otpBody.email).toBe('existing-user@example.test');
  expect(otpBody.create_user).toBe(false);
});

test('Google sign-in sends users through the Supabase OAuth callback', async ({ page }) => {
  let authorizeUrl = '';
  page.on('request', request => {
    if (request.url().includes('/auth/v1/authorize')) authorizeUrl = request.url();
  });
  await page.route('**/auth/v1/authorize**', async route => {
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Mock Google OAuth</title>' });
  });
  await page.goto('/login.html');
  await page.locator('#googleSignInButton').click();
  await expect.poll(() => authorizeUrl).not.toBe('');
  const parsed = new URL(authorizeUrl);
  expect(parsed.searchParams.get('provider')).toBe('google');
  expect(parsed.searchParams.get('redirect_to')).toContain('/login.html');
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

for (const route of ['/people.html', '/profile.html', '/services.html', '/communities.html', '/chat.html']) {
  test(`signed-out visitor cannot access private page ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL(/login\.html(?:$|[?#])/);
    await expect(page.locator('#authForm')).toHaveCount(1);
  });
}

test('signup blocks passwords found in public breach corpus before contacting Supabase Auth', async ({ page }) => {
  await page.route('https://api.pwnedpasswords.com/range/CBFDA', route =>
    route.fulfill({ status: 200, contentType: 'text/plain', body: 'C6008F9CAB4083784CBD1874F76618D2A97:123\r\n' })
  );
  await page.goto('/login.html');
  await page.locator('#signupTab').click();
  await page.locator('#fullName').fill('Test User');
  await page.locator('#email').fill('new-user@example.test');
  await page.locator('#password').fill('password123');
  await page.locator('#authForm').evaluate(form => form.requestSubmit());
  await expect(page.locator('#authNotice')).toContainText('ظهرت في تسريبات');
});

test('password breach check uses k-anonymity and blocks known compromised passwords', async ({ page }) => {
  let authOtpOrSignupCalls = 0;
  await page.route('https://api.pwnedpasswords.com/range/CBFDA', route =>
    route.fulfill({ status: 200, contentType: 'text/plain', body: 'C6008F9CAB4083784CBD1874F76618D2A97:123\r\n' })
  );
  await page.route('**/auth/v1/signup**', async route => {
    authOtpOrSignupCalls += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"should-not-be-called"}' });
  });
  await page.goto('/login.html');
  await page.locator('#signupTab').click();
  await page.locator('#fullName').fill('Test User');
  await page.locator('#email').fill('new-user@example.test');
  await page.locator('#password').fill('password123');
  await page.locator('#authForm').evaluate(form => form.requestSubmit());
  await expect(page.locator('#authNotice')).toContainText('ظهرت في تسريبات');
  expect(authOtpOrSignupCalls).toBe(0);
});

test('phone sign-in exposes country and phone fields before requesting an OTP', async ({ page }) => {
  await page.goto('/login.html');
  await page.locator('#phoneTab').click();
  await expect(page.locator('#phoneCountry')).toBeVisible();
  await expect(page.locator('#phoneNumber')).toBeVisible();
  await expect(page.locator('#otpCode')).toBeHidden();
  await expect(page.locator('#submitButton')).toHaveText('إرسال رمز SMS');
});
