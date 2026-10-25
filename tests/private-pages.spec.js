const { test, expect } = require('@playwright/test');

const mockSupabase = `
window.__mockCalls = [];
window.__mockTableData = {
  profiles: [{ id: 'other-user-uuid', username: 'someone', full_name: 'Someone', bio: 'Test profile', avatar_url: null }],
  chat_members: [], chat_messages: []
};
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
      then(resolve, reject) { return Promise.resolve({ data: window.__mockTableData?.[this._table] || [], error: null, count: (window.__mockTableData?.[this._table] || []).length }).then(resolve, reject); }
    };
    return {
      auth: {
        getSession: async () => ({ data: { session: { user: { id: 'test-user-uuid', email: 'tester@example.com', user_metadata: { full_name: 'Test User' } } } }, error: null }),
        signOut: async () => ({ error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
      },
      rpc: async () => ({ data: [], error: null }),
      from: (table) => {
        const q = Object.create(query); q._table = table;
        q._filters = [];
        q.select = function() { this._op = this._op || 'select'; return this; };
        q.eq = function(column, value) { this._filters.push([column, value]); return this; };
        q.maybeSingle = function() { const rows = window.__mockTableData?.[table] || []; const found = rows.find(row => this._filters.every(([column, value]) => row[column] === value)); return Promise.resolve({ data: found || null, error: null }); };
        q.single = function() { if (table === 'chats' && this._op === 'insert') return Promise.resolve({ data: { id: 'chat-test-uuid' }, error: null }); return Promise.resolve({ data: null, error: null }); };
        q.insert = function(payload) { this._op = 'insert'; window.__mockCalls.push({ table, op: 'insert', payload }); return this; };
        q.update = function(payload) { this._op = 'update'; window.__mockCalls.push({ table, op: 'update', payload }); return this; };
        q.delete = function() { this._op = 'delete'; window.__mockCalls.push({ table, op: 'delete' }); return this; };
        return q;
      },
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

test('authenticated member can submit a post through the feed flow', async ({ page }) => {
  const errors = await openAuthenticatedPage(page, '/home.html');
  await expect(page.locator('#postForm')).toBeVisible();
  await page.locator('#postContent').fill('Playwright feed smoke test');
  await page.locator('#publishButton').click();
  await expect.poll(async () => page.evaluate(() =>
    window.__mockCalls.some(call => call.table === 'posts' && call.op === 'insert' && call.payload.content === 'Playwright feed smoke test')
  )).toBe(true);
  expect(errors).toEqual([]);
});

test('authenticated member can save profile changes through the editor', async ({ page }) => {
  const errors = await openAuthenticatedPage(page, '/profile.html');
  await page.locator('#fullName').fill('Test Member');
  await page.locator('#username').fill('test_member_95');
  await page.locator('#bio').fill('Profile save regression test');
  await page.locator('#saveProfileButton').click();
  await expect.poll(async () => page.evaluate(() =>
    window.__mockCalls.some(call => call.table === 'profiles' && call.op === 'update' &&
      call.payload.username === 'test_member_95' && call.payload.full_name === 'Test Member')
  )).toBe(true);
  expect(errors).toEqual([]);
});

test('authenticated member can send a friend request from member search', async ({ page }) => {
  const errors = await openAuthenticatedPage(page, '/people.html');
  await expect(page.getByText('@someone')).toBeVisible();
  await page.getByRole('button', { name: 'إرسال طلب صداقة' }).click();
  await expect.poll(async () => page.evaluate(() =>
    window.__mockCalls.some(call => call.table === 'friend_requests' && call.op === 'insert' &&
      call.payload.requester_id === 'test-user-uuid' && call.payload.receiver_id === 'other-user-uuid')
  )).toBe(true);
  expect(errors).toEqual([]);
});

test('authenticated member can schedule a live session', async ({ page }) => {
  const errors = await openAuthenticatedPage(page, '/services.html');
  await page.locator('#liveTitle').fill('Live smoke test');
  await page.locator('#liveForm button[type="submit"]').click();
  await expect.poll(async () => page.evaluate(() =>
    window.__mockCalls.some(call => call.table === 'live_sessions' && call.op === 'insert' &&
      call.payload.user_id === 'test-user-uuid' && call.payload.title === 'Live smoke test')
  )).toBe(true);
  expect(errors).toEqual([]);
});

test('authenticated member can publish a story with media', async ({ page }) => {
  const errors = await openAuthenticatedPage(page, '/services.html');
  await page.locator('#storyMedia').setInputFiles({ name: 'story.png', mimeType: 'image/png', buffer: Buffer.from('mock-image') });
  await page.locator('#storyCaption').fill('Story upload smoke test');
  await page.locator('#storyForm button[type="submit"]').click();
  await expect.poll(async () => page.evaluate(() =>
    window.__mockCalls.some(call => call.table === 'stories' && call.op === 'insert' &&
      call.payload.user_id === 'test-user-uuid' && call.payload.caption === 'Story upload smoke test' &&
      call.payload.media_type === 'image')
  )).toBe(true);
  expect(errors).toEqual([]);
});

test('authenticated member can publish a reel with video', async ({ page }) => {
  const errors = await openAuthenticatedPage(page, '/services.html');
  await page.locator('#reelVideo').setInputFiles({ name: 'reel.mp4', mimeType: 'video/mp4', buffer: Buffer.from('mock-video') });
  await page.locator('#reelCaption').fill('Reel upload smoke test');
  await page.locator('#reelForm button[type="submit"]').click();
  await expect.poll(async () => page.evaluate(() =>
    window.__mockCalls.some(call => call.table === 'reels' && call.op === 'insert' &&
      call.payload.user_id === 'test-user-uuid' && call.payload.caption === 'Reel upload smoke test')
  )).toBe(true);
  expect(errors).toEqual([]);
});

test('authenticated member can send a direct message to another member', async ({ page }) => {
  const errors = await openAuthenticatedPage(page, '/services.html');
  await page.locator('#messageUsername').fill('someone');
  await page.locator('#loadChat').click();
  await expect(page.locator('#chatBox')).toContainText('ابدأ المحادثة');
  await page.locator('#messageBody').fill('Direct message smoke test');
  await page.locator('#messageForm button[type="submit"]').click();
  await expect.poll(async () => page.evaluate(() =>
    window.__mockCalls.some(call => call.table === 'direct_messages' && call.op === 'insert' &&
      call.payload.sender_id === 'test-user-uuid' && call.payload.recipient_id === 'other-user-uuid' &&
      call.payload.body === 'Direct message smoke test')
  )).toBe(true);
  expect(errors).toEqual([]);
});

test('messenger exposes voice recording and media attachment controls', async ({ page }) => {
  const errors = await openAuthenticatedPage(page, '/services.html');
  await expect(page.locator('#messageAttachment')).toHaveAttribute('accept', 'image/*,video/*,audio/*');
  await expect(page.locator('#recordVoiceButton')).toBeVisible();
  await expect(page.locator('#voiceRecordStatus')).toHaveAttribute('role', 'status');
  expect(errors).toEqual([]);
});

test('standalone MYGRAM Chat opens separately from Messenger', async ({ page }) => {
  const errors = await openAuthenticatedPage(page, '/chat.html');
  await expect(page.getByRole('heading', { name: '💬 MYGRAM Chat' })).toBeVisible();
  await expect(page.locator('#newChatForm')).toBeVisible();
  await expect(page.locator('#chatCompose')).toBeVisible();
  await expect(page.locator('#chatList')).toContainText('لا توجد محادثات بعد');
  expect(errors).toEqual([]);
});

test('standalone MYGRAM Chat can create a private conversation', async ({ page }) => {
  const errors = await openAuthenticatedPage(page, '/chat.html');
  await page.locator('#chatUsername').fill('someone');
  await page.locator('#newChatForm button').click();
  await expect(page.locator('#threadHead')).toContainText('Someone');
  await expect.poll(async () => page.evaluate(() =>
    window.__mockCalls.some(call => call.table === 'chats' && call.op === 'insert' && call.payload.created_by === 'test-user-uuid')
  )).toBe(true);
  await expect.poll(async () => page.evaluate(() =>
    window.__mockCalls.some(call => call.table === 'chat_members' && call.op === 'insert' &&
      Array.isArray(call.payload) && call.payload.length === 2)
  )).toBe(true);
  expect(errors).toEqual([]);
});
