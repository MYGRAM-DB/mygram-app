const { test, expect } = require('@playwright/test');

const communityMock = `
window.__mockCalls = [];
window.__mockTableData = { communities: [], community_members: [], community_posts: [] };
window.supabase = { createClient: () => {
  const query = {
    select() { return this; }, order() { return this; }, limit() { return this; }, eq() { return this; },
    insert(payload) {
      this._op = 'insert'; this._payload = payload;
      window.__mockCalls.push({ table: this._table, op: 'insert', payload });
      const rows = Array.isArray(payload) ? payload : [payload];
      for (const row of rows) {
        const saved = { ...row, id: row.id || (this._table === 'communities' ? 'community-test-uuid' : 'row-' + Math.random()), created_at: row.created_at || new Date().toISOString() };
        if (this._table === 'communities' || this._table === 'community_posts' || this._table === 'community_members') window.__mockTableData[this._table].push(saved);
        if (this._table === 'communities') this._singleResult = saved;
      }
      return this;
    },
    delete() { return this; }, update() { return this; },
    single() { return Promise.resolve({ data: this._singleResult || null, error: null }); },
    then(resolve, reject) { return Promise.resolve({ data: window.__mockTableData[this._table] || [], error: null }).then(resolve, reject); }
  };
  return {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'test-user-uuid', email: 'test@example.com' } } }, error: null }) },
    from: table => { const q = Object.create(query); q._table = table; return q; }
  };
} };
`;

async function openCommunityPage(page) {
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2**', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: communityMock })
  );
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/communities.html');
  return errors;
}

test('community page exposes community creation and discovery', async ({ page }) => {
  const errors = await openCommunityPage(page);
  await expect(page.getByRole('heading', { name: '🌍 مجتمعات MYGRAM' })).toBeVisible();
  await expect(page.locator('#communityForm')).toBeVisible();
  await expect(page.locator('#communityList')).toContainText('أنشئ أول مجتمع');
  expect(errors).toEqual([]);
});

test('member can create a community and becomes its owner', async ({ page }) => {
  const errors = await openCommunityPage(page);
  await page.locator('#communityName').fill('Photography Club');
  await page.locator('#communityDescription').fill('Share photography tips');
  await page.locator('#communityForm button').click();
  await expect.poll(async () => page.evaluate(() =>
    window.__mockCalls.some(call => call.table === 'communities' && call.op === 'insert' &&
      call.payload.name === 'Photography Club' && call.payload.created_by === 'test-user-uuid')
  )).toBe(true);
  await expect.poll(async () => page.evaluate(() =>
    window.__mockCalls.some(call => call.table === 'community_members' && call.op === 'insert' &&
      call.payload.community_id === 'community-test-uuid' && call.payload.role === 'owner')
  )).toBe(true);
  await expect(page.locator('#communityTitle')).toContainText('Photography Club');
  expect(errors).toEqual([]);
});

test('community members can publish posts inside their community', async ({ page }) => {
  const errors = await openCommunityPage(page);
  await page.locator('#communityName').fill('Book Lovers');
  await page.locator('#communityForm button').click();
  await page.locator('#communityPostContent').fill('My favorite book this month');
  await page.locator('#communityPostForm button').click();
  await expect.poll(async () => page.evaluate(() =>
    window.__mockCalls.some(call => call.table === 'community_posts' && call.op === 'insert' &&
      call.payload.community_id === 'community-test-uuid' && call.payload.user_id === 'test-user-uuid' &&
      call.payload.content === 'My favorite book this month')
  )).toBe(true);
  expect(errors).toEqual([]);
});
