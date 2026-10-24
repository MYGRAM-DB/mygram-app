const { test, expect } = require('@playwright/test');

const mockSupabase = `
window.supabase = {
  createClient: () => {
    const result = { data: [], error: null, count: 0 };
    const query = {
      select() { return this; }, insert() { return this; }, update() { return this; },
      delete() { return this; }, upsert() { return this; }, eq() { return this; },
      neq() { return this; }, in() { return this; }, or() { return this; }, gt() { return this; },
      order() { return this; }, limit() { return this; },
      maybeSingle() { return Promise.resolve({ data: null, error: null }); },
      single() { return Promise.resolve({ data: null, error: null }); },
      then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); }
    };
    return {
      auth: {
        getSession: async () => ({ data: { session: { user: { id: 'test-user-uuid', email: 'tester@example.com', user_metadata: { full_name: 'Test User' } } } }, error: null }),
        signOut: async () => ({ error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
      },
      from: () => Object.create(query),
      storage: { from: () => ({
        upload: async () => ({ data: { path: 'mock' }, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: 'https://example.test/mock.png' } })
      }) }
    };
  }
};
`;

async function openAuthenticatedPage(page, route) {
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2**', routeHandler =>
    routeHandler.fulfill({ status: 200, contentType: 'application/javascript', body: mockSupabase })
  );
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(route);
  await expect(page).not.toHaveURL(/index\.html(?:$|[?#])/);
  return pageErrors;
}

test('authenticated profile page exposes a working profile editor', async ({ page }) => {
  const errors = await openAuthenticatedPage(page, '/profile.html');
  await expect(page.locator('#profileForm')).toBeVisible();
  await expect(page.locator('#fullName')).toBeVisible();
  await expect(page.locator('#username')).toBeVisible();
  await expect(page.locator('#saveProfileButton')).toBeVisible();
  expect(errors).toEqual([]);
});

test('authenticated people page exposes member search and request sections', async ({ page }) => {
  const errors = await openAuthenticatedPage(page, '/people.html');
  await expect(page.locator('#searchInput')).toBeVisible();
  await expect(page.locator('#membersList')).toBeVisible();
  await expect(page.locator('#incomingList')).toBeVisible();
  await expect(page.locator('#outgoingList')).toBeVisible();
  expect(errors).toEqual([]);
});

test('authenticated services page exposes story, reel, live and messaging forms', async ({ page }) => {
  const errors = await openAuthenticatedPage(page, '/services.html');
  await expect(page.locator('#storyForm')).toBeVisible();
  await expect(page.locator('#reelForm')).toBeVisible();
  await expect(page.locator('#liveForm')).toBeVisible();
  await expect(page.locator('#messageForm')).toBeVisible();
  expect(errors).toEqual([]);
});
