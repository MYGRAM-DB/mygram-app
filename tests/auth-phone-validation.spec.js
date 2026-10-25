const { test, expect } = require('@playwright/test');

test('phone country picker contains the supported 205-country catalog', async ({ page }) => {
  await page.goto('/login.html');
  await page.locator('#phoneTab').click();
  const countries = page.locator('#phoneCountry option');
  await expect(countries).toHaveCount(205);
  await expect(page.locator('#phoneCountry')).toHaveValue('US');
  const catalog = await page.evaluate(() => window.MYGRAM_COUNTRIES.map(c => ({ code: c.code, dial: c.dial, nationalPrefix: c.nationalPrefix })));
  expect(new Set(catalog.map(c => c.code)).size).toBe(205);
  expect(catalog.every(c => new RegExp("^\\+[0-9]+(?:-[0-9]+)*$").test(c.dial))).toBe(true);
  const byCode = Object.fromEntries(catalog.map(c => [c.code, c.dial]));
  expect(byCode.US).toBe('+1');
  expect(byCode.NL).toBe('+31');
  expect(byCode.GB).toBe('+44');
  expect(byCode.IN).toBe('+91');
  expect(byCode.JP).toBe('+81');
  expect(byCode.GG).toBe('+44');
  expect(catalog.find(c => c.code === 'GG').nationalPrefix).toBe('1481');
  expect(byCode.AG).toBe('+1');
  expect(catalog.find(c => c.code === 'AG').nationalPrefix).toBe('268');

});

test('valid E.164 phone numbers pass local validation and reach Supabase OTP', async ({ page }) => {
  let otpRequests = 0;
  await page.route('**/auth/v1/otp**', async route => {
    otpRequests += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/login.html');
  await page.locator('#phoneTab').click();
  await page.locator('#phoneCountry').selectOption('US');
  await page.locator('#phoneNumber').fill('2025550123');
  await page.locator('#submitButton').click();
  await expect.poll(() => otpRequests).toBe(1);
  await expect(page.locator('#otpLabel')).toBeVisible();
});

test('malformed phone numbers are rejected before an OTP request', async ({ page }) => {
  let otpRequests = 0;
  await page.route('**/auth/v1/otp**', async route => {
    otpRequests += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/login.html');
  await page.locator('#phoneTab').click();
  await page.locator('#phoneCountry').selectOption('US');
  await page.locator('#phoneNumber').fill('123');
  await page.locator('#submitButton').click();
  await expect(page.locator('#authNotice')).toContainText('رقم الهاتف غير مكتمل');
  expect(otpRequests).toBe(0);
});

test('password minimum follows Supabase policy for signup but does not block existing logins', async ({ page }) => {
  await page.goto('/login.html');
  const password = page.locator('#password');
  await expect(password).toHaveAttribute('minlength', '1');
  await page.locator('#signupTab').click();
  await expect(password).toHaveAttribute('minlength', '8');
  await expect(password).toHaveAttribute('placeholder', '8 أحرف على الأقل');
  await page.locator('#loginTab').click();
  await expect(password).toHaveAttribute('minlength', '1');
});

test('territory national prefixes are applied once when creating E.164 numbers', async ({ page }) => {
  const sentPhones = [];
  await page.route('**/auth/v1/otp**', async route => {
    sentPhones.push(route.request().postDataJSON().phone);
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/login.html');
  await page.locator('#phoneTab').click();
  await page.locator('#phoneCountry').selectOption('GG');
  await page.locator('#phoneNumber').fill('123456');
  await page.locator('#submitButton').click();
  await expect.poll(() => sentPhones.length).toBe(1);
  expect(sentPhones[0]).toBe('+441481123456');
});
test('NANP territory prefixes are applied to seven-digit local numbers', async ({ page }) => {
  const sentPhones = [];
  await page.route('**/auth/v1/otp**', async route => {
    sentPhones.push(route.request().postDataJSON().phone);
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/login.html');
  await page.locator('#phoneTab').click();
  await page.locator('#phoneCountry').selectOption('AG');
  await page.locator('#phoneNumber').fill('5551234');
  await page.locator('#submitButton').click();
  await expect.poll(() => sentPhones.length).toBe(1);
  expect(sentPhones[0]).toBe('+12685551234');
});

test('NANP territory rejects a ten-digit number with the wrong area code', async ({ page }) => {
  let otpRequests = 0;
  await page.route('**/auth/v1/otp**', async route => {
    otpRequests += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/login.html');
  await page.locator('#phoneTab').click();
  await page.locator('#phoneCountry').selectOption('AG');
  await page.locator('#phoneNumber').fill('2025550123');
  await page.locator('#submitButton').click();
  await expect(page.locator('#authNotice')).toContainText('رقم الهاتف غير مكتمل');
  expect(otpRequests).toBe(0);
});
