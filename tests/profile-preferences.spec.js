const { test, expect } = require('@playwright/test');

test('profile settings load country catalog and private discovery preferences from their own table', async ({ page }) => {
  const userId = '43d5662c-a6a2-4cc9-94a9-ae4b7758e7c1';
  const now = Math.floor(Date.now() / 1000);
  await page.addInitScript(({ userId, now }) => {
    localStorage.setItem('sb-rocztskcyakvekokftfx-auth-token', JSON.stringify({
      access_token: 'test-access-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: now + 3600,
      refresh_token: 'test-refresh-token',
      user: {
        id: userId,
        aud: 'authenticated',
        role: 'authenticated',
        email: 'profile-test@example.com',
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: { full_name: 'Profile Test' },
        created_at: new Date(now * 1000).toISOString()
      }
    }));
  }, { userId, now });

  await page.route('**/rest/v1/profiles?**', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          username: 'profile_test',
          full_name: 'Profile Test',
          bio: '',
          avatar_url: null,
          cover_url: null,
          interests: ['technology']
        }])
      });
      return;
    }
    await route.fulfill({ status: 204, body: '' });
  });

  await page.route('**/rest/v1/profile_private_details**', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{
        user_id: userId, date_of_birth: '1992-10-07', gender: 'prefer_not_to_say', nationality_code: 'SY',
        contact_email: null, contact_phone: null
      }]) });
      return;
    }
    await route.fulfill({ status: 204, body: '' });
  });

  await page.route('**/rest/v1/user_preferences**', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          language_code: 'en',
          current_country_code: 'NL',
          nationality_code: 'SY',
          region: 'South Holland',
          city_name: 'Naaldwijk',
          share_location: false
        }])
      });
      return;
    }
    await route.fulfill({ status: 204, body: '' });
  });

  await page.goto('/profile.html');
  await expect(page.locator('#fullName')).toHaveValue('Profile Test');
  await expect(page.locator('#preferredLanguage')).toHaveValue('en');
  await expect(page.locator('#countryCode')).toHaveValue('NL');
  await expect(page.locator('#nationalityCode')).toHaveValue('SY');
  await expect(page.locator('#region')).toHaveValue('South Holland');
  await expect(page.locator('#city')).toHaveValue('Naaldwijk');
  await expect(page.locator('#discoveryEnabled')).not.toBeChecked();
  await expect(page.locator('#countryCode option')).toHaveCount(206); // blank option + 205 countries
});
