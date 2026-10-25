const { test, expect } = require('@playwright/test');

test('discover page renders server-ranked local and interest recommendations', async ({ page }) => {
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
        email: 'discover-test@example.com',
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: { full_name: 'Discover Test' },
        created_at: new Date(now * 1000).toISOString()
      }
    }));
  }, { userId, now });

  await page.route('**/rest/v1/profiles?**', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/rest/v1/friend_requests?**', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/rest/v1/rpc/recommend_mygram_profiles', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        username: 'nearby_member',
        full_name: 'Nearby Member',
        avatar_url: null,
        shared_interests: ['music'],
        match_reason: 'same_city'
      }])
    });
  });

  await page.goto('/people.html');
  await expect(page.locator('#recommendationsList')).toContainText('Nearby Member');
  await expect(page.locator('#recommendationsList')).toContainText('في مدينتك');
});
