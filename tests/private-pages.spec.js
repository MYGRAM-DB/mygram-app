const { test, expect } = require('@playwright/test');

const mockSupabase = `
window.__mockCalls = [];
window.__mockChannels = [];
window.__mockFunctionInvocations = [];
window.__mockTableData = {
  profiles: [{ id: 'other-user-uuid', username: 'someone', full_name: 'Someone', bio: 'Test profile', avatar_url: null }],
  reels: [{ id: 'reel-test-uuid', user_id: 'other-user-uuid', video_url: 'https://example.test/reel.mp4', caption: 'A test reel', created_at: '2026-10-25T10:00:00.000Z' }],
  reel_reactions: [], reel_comments: [], chat_members: [], chat_messages: []
};
window.supabase = {
  createClient: () => {
    const result = { data: [], error: null, count: 0 };
    const query = {
      select() { return this; }, insert() { return this; }, update() { return this; },
      delete() { return this; }, upsert() { return this; }, eq() { return this; }, is() { return this; },
      neq() { return this; }, in() { return this; }, or() { return this; }, ilike() { return this; }, gt() { return this; },
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
      functions: {
        invoke: async (name, options) => {
          const body = options?.body || {};
          window.__mockFunctionInvocations.push({ name, body });
          const translations = Object.fromEntries((body.items || []).map(item => [
            item.key,
            window.__translationTestMode && body.targetLocale === 'es' ? 'AI:' + item.text : item.text
          ]));
          return { data: { translations, cached: false }, error: null };
        }
      },
      rpc: async () => ({ data: [], error: null }),
      from: (table) => {
        const q = Object.create(query); q._table = table;
        q._filters = [];
        q.select = function() { this._op = this._op || 'select'; return this; };
        q.eq = function(column, value) { this._filters.push([column, value]); return this; };
        q.maybeSingle = function() { const rows = window.__mockTableData?.[table] || []; const found = rows.find(row => this._filters.every(([column, value]) => row[column] === value)); return Promise.resolve({ data: found || null, error: null }); };
        q.single = function() { if (table === 'chats' && this._op === 'insert') return Promise.resolve({ data: { id: 'chat-test-uuid' }, error: null }); return Promise.resolve({ data: null, error: null }); };
        q.insert = function(payload) {
          this._op = 'insert';
          window.__mockCalls.push({ table, op: 'insert', payload });
          if (table === 'direct_messages') {
            const rows = window.__mockTableData.direct_messages || (window.__mockTableData.direct_messages = []);
            rows.push({ id: 'direct-message-test-' + (rows.length + 1), ...payload, created_at: new Date().toISOString(), read_at: null });
          }
          return this;
        };
        q.update = function(payload) { this._op = 'update'; window.__mockCalls.push({ table, op: 'update', payload }); return this; };
        q.delete = function() { this._op = 'delete'; window.__mockCalls.push({ table, op: 'delete' }); return this; };
        q.upsert = function(payload) { this._op = 'upsert'; window.__mockCalls.push({ table, op: 'upsert', payload }); if (table === 'user_presence') { const rows = window.__mockTableData.user_presence || (window.__mockTableData.user_presence = []); const index = rows.findIndex(row => row.user_id === payload.user_id); if (index < 0) rows.push({ ...payload }); else Object.assign(rows[index], payload); } return this; };
        return q;
      },
      channel(name) { const channel = { name, handlers: [], on(event, filter, callback) { this.handlers.push({ event, filter }); return this; }, subscribe() { window.__mockChannels.push({ name, handlers: this.handlers }); return this; } }; return channel; },
      removeChannel: async () => 'ok',
      storage: { from: () => ({
        upload: async () => ({ data: { path: 'mock' }, error: null }),
        createSignedUrl: async path => ({ data: { signedUrl: 'https://example.test/' + encodeURIComponent(path) }, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: 'https://example.test/mock.png' } })
      }) }
    };
  }
};
`;

async function selectServiceTab(page, name) {
  await page.locator('[data-service-tab="' + name + '"]').click();
}

async function selectPeopleTab(page, name) {
  await page.locator('[data-people-tab="' + name + '"]').click();
}

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

test('signed-in home exposes the notification bell and opens its panel', async ({ page }) => {
  const errors = await openAuthenticatedPage(page, '/home.html');
  const bell = page.locator('.mygram-notifications-trigger');
  await expect(bell).toBeVisible();
  await bell.click();
  await expect(page.locator('.mygram-notifications-panel')).toBeVisible();
  await expect(page.locator('.mygram-notifications-empty')).toContainText('أنت على اطلاع');
  expect(errors).toEqual([]);
});

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
  await selectPeopleTab(page, 'search');
  await expect(page.locator('#searchInput')).toBeVisible();
  await expect(page.locator('#membersList')).toBeVisible();
  await selectPeopleTab(page, 'incoming');
  await expect(page.locator('#incomingList')).toBeVisible();
  await selectPeopleTab(page, 'outgoing');
  await expect(page.locator('#outgoingList')).toBeVisible();
  expect(errors).toEqual([]);
});

test('authenticated services page exposes story, reel, live and messaging forms', async ({ page }) => {
  const errors = await openAuthenticatedPage(page, '/services.html');
  await expect(page.locator('#storyForm')).toBeVisible();
  await selectServiceTab(page, 'reels');
  await expect(page.locator('#reelForm')).toBeVisible();
  await selectServiceTab(page, 'live');
  await expect(page.locator('#liveForm')).toBeVisible();
  await selectServiceTab(page, 'messages');
  await expect(page.locator('#messageForm')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Messenger subscribes to realtime incoming and outgoing direct messages', async ({ page }) => {
  await openAuthenticatedPage(page, '/services.html');
  await expect.poll(() => page.evaluate(() => window.__mockChannels.some(channel => channel.name.includes('mygram-direct-messages-test-user-uuid')))).toBe(true);
  const channel = await page.evaluate(() => window.__mockChannels.find(channel => channel.name.includes('mygram-direct-messages-test-user-uuid')));
  expect(channel.name).toContain('mygram-direct-messages-test-user-uuid');
  expect(channel.handlers).toHaveLength(2);
  expect(channel.handlers.map(h => h.filter.table)).toEqual(['direct_messages', 'direct_messages']);
  expect(channel.handlers.map(h => h.filter.filter)).toEqual([
    'sender_id=eq.test-user-uuid', 'recipient_id=eq.test-user-uuid'
  ]);
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
  await page.locator('#firstName').fill('Test');
  await page.locator('#lastName').fill('Member');
  await page.locator('#dateOfBirth').fill('1992-10-07');
  await page.locator('#fullName').fill('Test Member');
  await page.locator('#username').fill('test_member_95');
  await page.locator('#bio').fill('Profile save regression test');
  const saveButton = page.locator('#saveProfileButton');
  await saveButton.scrollIntoViewIfNeeded();
  const saveButtonIsPointerTarget = await saveButton.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) === el;
  });
  expect(saveButtonIsPointerTarget).toBe(true);
  // Chromium's mobile device emulation reports a different layout viewport while the
  // button's DOM hit-test is correct; exercise the real form-submit click handler
  // directly in that project instead of flaking on the emulated coordinate mapping.
  if (test.info().project.name === 'chromium-mobile') {
    await saveButton.evaluate(el => el.click());
  } else {
    await saveButton.click();
  }
  await expect.poll(async () => page.evaluate(() =>
    window.__mockCalls.some(call => call.table === 'profiles' && call.op === 'update' &&
      call.payload.username === 'test_member_95' && call.payload.full_name === 'Test Member')
  )).toBe(true);
  expect(errors).toEqual([]);
});

test('authenticated member can send a friend request from member search', async ({ page }) => {
  const errors = await openAuthenticatedPage(page, '/people.html');
  await selectPeopleTab(page, 'search');
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
  await selectServiceTab(page, 'live');
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
  await selectServiceTab(page, 'reels');
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
  await selectServiceTab(page, 'messages');
  await page.locator('#messageUsername').fill('someone');
  await page.locator('#loadChat').click();
  await expect(page.locator('#chatBox')).toContainText('ابدأ المحادثة');
  await expect(page.locator('#dmCallToolbar')).toBeVisible();
  await expect(page.locator('#dmAudioCallButton')).toBeDisabled();
  await expect(page.locator('#dmVideoCallButton')).toBeDisabled();
  await expect.poll(() => page.evaluate(() => window.__mockChannels.some(channel => channel.name === 'direct-call-signals-test-user-uuid'))).toBe(true);
  await page.locator('#messageBody').fill('Direct message smoke test');
  await page.locator('#messageForm button[type="submit"]').click();
  await expect.poll(async () => page.evaluate(() =>
    window.__mockCalls.some(call => call.table === 'direct_messages' && call.op === 'insert' &&
      call.payload.sender_id === 'test-user-uuid' && call.payload.recipient_id === 'other-user-uuid' &&
      call.payload.body === 'Direct message smoke test')
  )).toBe(true);
  await expect(page.locator('#dmAudioCallButton')).toBeEnabled();
  await expect(page.locator('#dmVideoCallButton')).toBeEnabled();
  expect(errors).toEqual([]);
});

test('messenger exposes voice recording and media attachment controls', async ({ page }) => {
  const errors = await openAuthenticatedPage(page, '/services.html');
  await selectServiceTab(page, 'messages');
  await expect(page.locator('#messageAttachment')).toHaveAttribute('accept', 'image/*,video/*,audio/*');
  await expect(page.locator('#recordVoiceButton')).toBeVisible();
  await expect(page.locator('#voiceRecordStatus')).toHaveAttribute('role', 'status');
  expect(errors).toEqual([]);
});

test('authenticated member can react to a reel with emoji', async ({ page }) => {
  const errors = await openAuthenticatedPage(page, '/services.html');
  await selectServiceTab(page, 'reels');
  const reel = page.locator('#reelsList .reel-card').first();
  await expect(reel).toBeVisible();
  await reel.getByRole('button', { name: 'تفاعل ❤️' }).click();
  await expect.poll(async () => page.evaluate(() =>
    window.__mockCalls.some(call => call.table === 'reel_reactions' && call.op === 'upsert' &&
      call.payload.reel_id === 'reel-test-uuid' && call.payload.reaction === 'love')
  )).toBe(true);
  expect(errors).toEqual([]);
});

test('authenticated member can comment on a reel', async ({ page }) => {
  const errors = await openAuthenticatedPage(page, '/services.html');
  await selectServiceTab(page, 'reels');
  const form = page.locator('#reelsList .reel-card .reel-comment-form').first();
  await form.locator('input').fill('Great reel!');
  await form.getByRole('button', { name: 'إرسال' }).click();
  await expect.poll(async () => page.evaluate(() =>
    window.__mockCalls.some(call => call.table === 'reel_comments' && call.op === 'insert' &&
      call.payload.reel_id === 'reel-test-uuid' && call.payload.content === 'Great reel!')
  )).toBe(true);
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

test('standalone MYGRAM Chat can create a group conversation', async ({ page }) => {
  const errors = await openAuthenticatedPage(page, '/chat.html');
  await page.evaluate(() => window.__mockTableData.profiles.push({ id: 'second-user-uuid', username: 'another', full_name: 'Another Person', bio: 'Second test profile', avatar_url: null }));
  await page.locator('#chatUsername').fill('someone, another');
  await page.locator('#newChatForm button').click();
  await expect(page.locator('#threadHead')).toContainText('Someone, Another Person');
  await expect.poll(async () => page.evaluate(() =>
    window.__mockCalls.some(call => call.table === 'chats' && call.op === 'insert' &&
      call.payload.created_by === 'test-user-uuid' && call.payload.is_group === true)
  )).toBe(true);
  await expect.poll(async () => page.evaluate(() =>
    window.__mockCalls.some(call => call.table === 'chat_members' && call.op === 'insert' &&
      Array.isArray(call.payload) && call.payload.length === 3)
  )).toBe(true);
  expect(errors).toEqual([]);
});

test('signed-in language fallback invokes translate-text and leaves user content unchanged', async ({ page }) => {
  await page.addInitScript(() => { window.__translationTestMode = true; });
  const errors = await openAuthenticatedPage(page, '/profile.html');
  await page.evaluate(() => {
    const ui = document.createElement('p');
    ui.id = 'translationFallbackFixture';
    ui.textContent = 'Untranslated MYGRAM test label';
    document.querySelector('main').prepend(ui);
    const userContent = document.createElement('p');
    userContent.id = 'translationUserFixture';
    userContent.className = 'post-body';
    userContent.textContent = 'Untranslated user post must stay original';
    document.querySelector('main').appendChild(userContent);
    window.MYGRAM_APPLY_LANGUAGE('es');
  });
  await expect(page.locator('#translationFallbackFixture')).toHaveText('AI:Untranslated MYGRAM test label');
  await expect(page.locator('#translationUserFixture')).toHaveText('Untranslated user post must stay original');
  const calls = await page.evaluate(() => window.__mockFunctionInvocations.filter(call => call.name === 'translate-text'));
  expect(calls.some(call => call.body.targetLocale === 'es' && call.body.sourceLocale === 'auto' &&
    call.body.items.some(item => item.text === 'Untranslated MYGRAM test label'))).toBe(true);
  expect(calls.every(call => call.body.items.every(item => item.text !== 'Untranslated user post must stay original'))).toBe(true);
  expect(errors).toEqual([]);
});


test('direct Messenger shows the recipient avatar, live dot, voice bubble, and hide-status preference', async ({ page }) => {
  const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/nWQAAAAASUVORK5CYII=', 'base64');
  await page.route('https://example.test/avatar.png', route => route.fulfill({ status: 200, contentType: 'image/png', body: transparentPng }));
  const errors = await openAuthenticatedPage(page, '/services.html');
  await page.evaluate(() => {
    window.__mockTableData.profiles[0].avatar_url = 'https://example.test/avatar.png';
    window.__mockTableData.user_presence = [
      { user_id: 'test-user-uuid', show_online_status: true, last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { user_id: 'other-user-uuid', show_online_status: true, last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    ];
    window.__mockTableData.direct_messages = [{
      id: 'voice-message-1', sender_id: 'other-user-uuid', recipient_id: 'test-user-uuid',
      body: '🎙️ رسالة صوتية', attachment_url: 'other-user-uuid/messages/voice.webm',
      attachment_type: 'audio', duration_seconds: 7, created_at: '2026-10-26T00:00:00.000Z', read_at: null
    }];
  });
  await selectServiceTab(page, 'messages');
  await page.locator('#messageUsername').fill('someone');
  await page.locator('#loadChat').click();
  await expect(page.locator('#dmConversationHeader')).toBeVisible();
  await expect(page.locator('#dmPeerName')).toHaveText('Someone');
  await expect(page.locator('#dmPeerAvatar img')).toHaveAttribute('src', 'https://example.test/avatar.png');
  await expect(page.locator('#dmPeerPresence')).toContainText('متصل الآن');
  await expect(page.locator('#dmPeerPresence .presence-dot.is-online')).toBeVisible();
  await expect(page.locator('.dm-message-bubble .voice-note-card audio')).toBeVisible();
  await expect(page.locator('.dm-message-bubble .voice-note-copy small')).toHaveText('00:07');
  const toggle = page.locator('#showPresenceToggle');
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect.poll(() => page.evaluate(() =>
    window.__mockCalls.some(call => call.table === 'user_presence' && call.op === 'upsert' &&
      call.payload.user_id === 'test-user-uuid' && call.payload.show_online_status === false && call.payload.last_seen_at === null)
  )).toBe(true);
  expect(errors).toEqual([]);
});

test('standalone MYGRAM Chat shows peer identity and playable voice-note bubbles', async ({ page }) => {
  const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/nWQAAAAASUVORK5CYII=', 'base64');
  await page.route('https://example.test/chat-avatar.png', route => route.fulfill({ status: 200, contentType: 'image/png', body: transparentPng }));
  const errors = await openAuthenticatedPage(page, '/chat.html');
  await page.evaluate(() => {
    window.__mockTableData.profiles[0].avatar_url = 'https://example.test/chat-avatar.png';
    window.__mockTableData.user_presence = [
      { user_id: 'test-user-uuid', show_online_status: true, last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { user_id: 'other-user-uuid', show_online_status: true, last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    ];
    window.__mockTableData.chat_messages = [{
      id: 'chat-voice-message-1', chat_id: 'chat-test-uuid', sender_id: 'other-user-uuid',
      body: '🎙️ رسالة صوتية', attachment_url: 'other-user-uuid/chats/chat-test-uuid/voice.webm',
      attachment_type: 'audio', duration_seconds: 11, created_at: '2026-10-26T00:00:00.000Z'
    }, {
      id: 'chat-text-message-2', chat_id: 'chat-test-uuid', sender_id: 'test-user-uuid',
      body: 'رسالة مني', attachment_url: null, attachment_type: null, duration_seconds: null,
      created_at: '2026-10-26T00:00:01.000Z'
    }];
  });
  await page.locator('#chatUsername').fill('someone');
  await page.locator('#newChatForm button').click();
  await expect(page.locator('#threadHead .thread-peer-name')).toHaveText('Someone');
  await expect(page.locator('#threadHead .presence-avatar img')).toHaveAttribute('src', 'https://example.test/chat-avatar.png');
  await expect(page.locator('#activePeerPresence')).toContainText('متصل الآن');
  await expect(page.locator('#activePeerPresence .presence-dot.is-online')).toBeVisible();
  await expect(page.locator('#chatMessages .chat-bubble .voice-note-card audio')).toBeVisible();
  await expect(page.locator('#chatMessages .voice-note-copy small')).toHaveText('00:11');
  const incomingBubble = await page.locator('#chatMessages .chat-bubble:not(.mine)').boundingBox();
  const outgoingBubble = await page.locator('#chatMessages .chat-bubble.mine').boundingBox();
  expect(incomingBubble).not.toBeNull();
  expect(outgoingBubble).not.toBeNull();
  expect(outgoingBubble.x).toBeGreaterThan(incomingBubble.x);
  await expect(page.locator('#showPresenceToggle')).toBeChecked();
  await expect(page.locator('#mygramMessagingTools')).toBeVisible();
  await page.locator('#mygramMessagingTools [data-kind="topics"]').click();
  await expect(page.getByPlaceholder('اسم الموضوع الجديد')).toBeVisible();
  await page.locator('#chatMessages .chat-bubble:not(.mine) button[aria-label="الرد على الرسالة"]').click();
  await expect(page.locator('#mygramReplyIndicator')).toBeVisible();
  await expect(page.locator('#mygramReplyText')).toContainText('رسالة صوتية');
  await page.locator('#chatBody').fill('رد اختبار');
  await page.locator('#chatCompose button[type="submit"]').click();
  await expect.poll(async () => page.evaluate(() =>
    window.__mockCalls.some(call => call.table === 'chat_messages' && call.op === 'insert' &&
      call.payload.reply_to_message_id === 'chat-voice-message-1' && call.payload.body === 'رد اختبار')
  )).toBe(true);
  await expect(page.locator('#mygramReplyIndicator')).toBeHidden();
  await page.locator('#chatMessages .chat-bubble:not(.mine) button[aria-label="تفاعل 👍"]').click();
  await expect.poll(async () => page.evaluate(() =>
    window.__mockCalls.some(call => call.table === 'messaging_message_reactions' && call.op === 'insert' &&
      call.payload.source === 'messenger' && call.payload.message_id === 'chat-voice-message-1' &&
      call.payload.emoji === '👍' && call.payload.user_id === 'test-user-uuid')
  )).toBe(true);
  expect(errors).toEqual([]);
});


test('signed-in MYGRAM Meetings page exposes scheduling, invitations and meeting controls', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/npm/livekit-client@2.23.0/**', routeHandler =>
    routeHandler.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.LivekitClient = window.LivekitClient || {};' })
  );
  const errors = await openAuthenticatedPage(page, '/meetings.html');
  await expect(page.getByRole('heading', { name: 'اجتماعات MYGRAM' })).toBeVisible();
  await expect(page.locator('#createMeetingForm')).toBeVisible();
  await expect(page.locator('#joinMeetingForm')).toBeVisible();
  await expect(page.locator('#meetingList')).toContainText('ابدأ اجتماعك الأول');
  await expect(page.locator('.meet-capacity strong')).toHaveText('31');
  expect(errors).toEqual([]);
});

test('WHATSMYGRAM page loads its own audio/video calling controls', async ({ page }) => {
  const errors = await openAuthenticatedPage(page, '/whatsmygram.html');
  await expect(page.locator('body')).toContainText('WHATSMYGRAM');
  await expect(page.locator('a[href="meetings.html"]')).toBeVisible();
  await expect(page.locator('#waAudioCallButton')).toBeAttached();
  await expect(page.locator('#waVideoCallButton')).toBeAttached();
  await expect(page.locator('#waCallMedia')).toBeHidden();
  expect(errors).toEqual([]);
});

test('direct Messenger exposes shared search and saved-message tools in a private thread', async ({ page }) => {
  const errors = await openAuthenticatedPage(page, '/services.html');
  await selectServiceTab(page, 'messages');
  await page.locator('#messageUsername').fill('someone');
  await page.locator('#loadChat').click();
  await expect(page.locator('#mygramMessagingTools')).toBeVisible();
  await expect(page.locator('#mygramMessagingTools [data-kind="search"]')).toBeVisible();
  await expect(page.locator('#mygramMessagingTools [data-kind="bookmarks"]')).toBeVisible();
  await expect(page.locator('#mygramMessagingTools [data-kind="topics"]')).toBeHidden();
  await page.locator('#mygramMessagingTools [data-kind="search"]').click();
  await expect(page.getByPlaceholder('ابحث في رسائل هذه المحادثة…')).toBeVisible();
  expect(errors).toEqual([]);
});


test('discover page searches people and renders safe result cards', async ({ page }) => {
  const errors = await openAuthenticatedPage(page, '/discover.html');
  await page.locator('#discoverQuery').fill('someone');
  await page.locator('#discoverSubmit').click();
  await expect(page.locator('#peopleResults')).toContainText('@someone');
  await expect(page.locator('#peopleResults')).toContainText('Someone');
  await expect(page.locator('#discoverStatus')).toContainText('1 أشخاص');
  expect(errors).toEqual([]);
});
