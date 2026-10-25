const { test, expect } = require('@playwright/test');

test('phone country picker contains the supported 205-country catalog', async ({ page }) => {
  await page.goto('/login.html');
  await page.locator('#phoneTab').click();
  const countries = page.locator('#phoneCountry option');
  await expect(countries).toHaveCount(205);
  await expect(page.locator('#phoneCountry')).toHaveValue('US');
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
