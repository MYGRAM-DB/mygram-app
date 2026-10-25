const { test, expect } = require('@playwright/test');

const mockSupabase = `
window.__channels = [];
window.supabase = { createClient: () => ({
  auth: { getSession: async () => ({ data: { session: { access_token: 'mock-access-token', user: { id: 'test-user-uuid', email: 'tester@example.com' } } }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  from(table) {
    const q = { _table: table, _op: 'select', _filters: [], _payload: null,
      select() { return this; }, eq(k,v) { this._filters.push([k,v]); return this; }, in() { return this; }, order() { return this; }, limit() { return this; },
      insert(payload) { this._op='insert'; this._payload=payload; return this; },
      maybeSingle() { return Promise.resolve({ data: table==='profiles' ? { id:'other-user-uuid', username:'someone', full_name:'Someone' } : null, error:null }); },
      single() { return Promise.resolve({ data: table==='chats' ? { id:'chat-test-uuid' } : null, error:null }); },
      then(resolve,reject) { return Promise.resolve({ data: [], error:null }).then(resolve,reject); }
    }; return q;
  },
  channel(name) { const c={ name, handlers:[], on(event,filter,callback){this.handlers.push({event,filter});return this;}, subscribe(){window.__channels.push({name,handlers:this.handlers});return this;} }; return c; },
  removeChannel: async () => 'ok',
  storage: { from: () => ({ upload: async () => ({ data:{path:'mock'},error:null }), createSignedUrl: async () => ({ data:{signedUrl:'https://example.test/mock'},error:null }) }) }
}) };
`;

test('standalone chat subscribes to realtime updates for the active private conversation', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2**', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: mockSupabase })
  );
  await page.goto('/chat.html');
  await page.locator('#chatUsername').fill('someone');
  await page.locator('#newChatForm button').click();
  await expect(page.locator('#threadHead')).toContainText('Someone');
  await expect.poll(() => page.evaluate(() => window.__channels.length)).toBe(2);
  const subscription = await page.evaluate(() => window.__channels.find(c => c.name === 'mygram-chat-chat-test-uuid'));
  expect(subscription.handlers[0].event).toBe('postgres_changes');
  expect(subscription.handlers[0].filter.table).toBe('chat_messages');
  expect(subscription.handlers[0].filter.filter).toBe('chat_id=eq.chat-test-uuid');
});

test('standalone chat exposes one-to-one audio and video call controls', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2**', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: mockSupabase })
  );
  await page.goto('/chat.html');
  await expect(page.locator('#audioCallButton')).toBeVisible();
  await expect(page.locator('#videoCallButton')).toBeVisible();
  await expect(page.locator('#acceptCallButton')).toBeHidden();
  await expect(page.locator('#endCallButton')).toBeHidden();
});

test('one-to-one calls request short-lived TURN credentials for the active chat', async ({ page }) => {
  let turnRequest = null;
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2**', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: mockSupabase })
  );
  await page.route('**/functions/v1/turn-credentials', async route => {
    turnRequest = { headers: route.request().headers(), body: route.request().postDataJSON() };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ iceServers: [{ urls: ['stun:stun.cloudflare.com:3478'] }] }) });
  });
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => new MediaStream();
    window.RTCPeerConnection = class {
      constructor(config) { window.__iceServers = config.iceServers; this.connectionState = 'new'; }
      addTrack() {}
      async createOffer() { return { type: 'offer', sdp: 'v=0\\r\\n' }; }
      async setLocalDescription(description) { this.localDescription = description; }
      close() {}
    };
  });
  await page.goto('/chat.html');
  await page.locator('#chatUsername').fill('someone');
  await page.locator('#newChatForm button').click();
  await expect(page.locator('#threadHead')).toContainText('Someone');
  await page.locator('#audioCallButton').click();
  await expect.poll(() => turnRequest !== null).toBe(true);
  expect(turnRequest.headers.authorization).toBe('Bearer mock-access-token');
  expect(turnRequest.body.chatId).toBe('chat-test-uuid');
  await expect.poll(() => page.evaluate(() => Array.isArray(window.__iceServers))).toBe(true);
  expect(await page.evaluate(() => window.__iceServers[0].urls)).toContain('stun:stun.cloudflare.com:3478');
});
