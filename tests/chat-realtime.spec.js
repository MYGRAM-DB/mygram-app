const { test, expect } = require('@playwright/test');

const mockSupabase = `
window.__channels = [];
window.__mockCalls = [];
window.__mockTableData = window.__chatSeed || {
  profiles: [{ id:'other-user-uuid', username:'someone', full_name:'Someone' }],
  chats: [], chat_members: [], chat_messages: []
};
window.supabase = { createClient: () => ({
  auth: { getSession: async () => ({ data: { session: { access_token: 'mock-access-token', user: { id: 'test-user-uuid', email: 'tester@example.com' } } }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  from(table) {
    const q = { _table: table, _op: 'select', _filters: [], _payload: null, _in: null,
      select() { return this; }, eq(k,v) { this._filters.push([k,v]); return this; }, in(k,values) { this._in=[k,values]; return this; }, order() { return this; }, limit() { return this; },
      insert(payload) { this._op='insert'; this._payload=payload; window.__mockCalls.push({table,op:'insert',payload}); if(table==='chats'){this._inserted={id:'chat-test-uuid',...payload};window.__mockTableData.chats.push(this._inserted)} if(table==='chat_members'){window.__mockTableData.chat_members.push(...(Array.isArray(payload)?payload:[payload]))} return this; },
      maybeSingle() { return Promise.resolve({ data: table==='profiles' ? { id:'other-user-uuid', username:'someone', full_name:'Someone' } : null, error:null }); },
      single() { return Promise.resolve({ data: table==='chats' ? this._inserted||{ id:'chat-test-uuid' } : null, error:null }); },
      then(resolve,reject) { if(table==='chats'&&window.__mockQueryError)return Promise.resolve({data:null,error:{message:'lookup failed'}}).then(resolve,reject); const rows=(window.__mockTableData[table]||[]).filter(row=>this._filters.every(([key,value])=>row[key]===value)&&(!this._in||this._in[1].includes(row[this._in[0]]))); return Promise.resolve({ data: rows, error:null }).then(resolve,reject); }
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
  await expect.poll(() => page.evaluate(() => window.__channels.some(c => c.name === 'mygram-chat-chat-test-uuid'))).toBe(true);
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

test('a shared group chat is not reused as a one-to-one chat', async ({ page }) => {
  await page.addInitScript(() => {
    window.__chatSeed = {
      profiles: [{ id:'other-user-uuid', username:'someone', full_name:'Someone' }],
      chats: [
        { id:'shared-group-chat', is_group:true, title:'Shared group' },
        { id:'non-exact-direct-chat', is_group:false, title:null }
      ],
      chat_members: [
        { chat_id:'shared-group-chat', user_id:'test-user-uuid' },
        { chat_id:'shared-group-chat', user_id:'other-user-uuid' },
        { chat_id:'shared-group-chat', user_id:'third-user-uuid' },
        { chat_id:'non-exact-direct-chat', user_id:'test-user-uuid' },
        { chat_id:'non-exact-direct-chat', user_id:'other-user-uuid' },
        { chat_id:'non-exact-direct-chat', user_id:'third-user-uuid' }
      ],
      chat_messages: []
    };
  });
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2**', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: mockSupabase })
  );
  await page.goto('/chat.html');
  await page.locator('#chatUsername').fill('someone');
  await page.locator('#newChatForm button').click();
  await expect(page.locator('#threadHead')).toContainText('Someone');
  await expect.poll(() => page.evaluate(() =>
    window.__mockCalls.some(call => call.table === 'chats' && call.op === 'insert' && call.payload.is_group === false)
  )).toBe(true);
  const result = await page.evaluate(() => ({
    chat: window.__mockTableData.chats.find(row => row.id === 'chat-test-uuid'),
    members: window.__mockTableData.chat_members.filter(row => row.chat_id === 'chat-test-uuid')
  }));
  expect(result.chat).toMatchObject({ is_group: false, created_by: 'test-user-uuid' });
  expect(result.members.map(member => member.user_id).sort()).toEqual(['other-user-uuid', 'test-user-uuid']);
});

test('an exact existing one-to-one chat is reused', async ({ page }) => {
  await page.addInitScript(() => {
    window.__chatSeed = {
      profiles: [{ id:'other-user-uuid', username:'someone', full_name:'Someone' }],
      chats: [{ id:'existing-direct-chat', is_group:false, title:null }],
      chat_members: [
        { chat_id:'existing-direct-chat', user_id:'test-user-uuid' },
        { chat_id:'existing-direct-chat', user_id:'other-user-uuid' }
      ],
      chat_messages: []
    };
  });
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2**', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: mockSupabase })
  );
  await page.goto('/chat.html');
  await page.locator('#chatUsername').fill('someone');
  await page.locator('#newChatForm button').click();
  await expect(page.locator('#threadHead')).toContainText('Someone');
  await expect.poll(() => page.evaluate(() => window.__channels.some(c => c.name === 'mygram-chat-existing-direct-chat'))).toBe(true);
  expect(await page.evaluate(() => window.__mockCalls.some(call => call.table === 'chats' && call.op === 'insert'))).toBe(false);
});

test('a failed direct-chat lookup is reported without creating a chat', async ({ page }) => {
  await page.addInitScript(() => {
    window.__chatSeed = {
      profiles: [{ id:'other-user-uuid', username:'someone', full_name:'Someone' }],
      chats: [{ id:'shared-group-chat', is_group:true, title:'Shared group' }],
      chat_members: [
        { chat_id:'shared-group-chat', user_id:'test-user-uuid' },
        { chat_id:'shared-group-chat', user_id:'other-user-uuid' },
        { chat_id:'shared-group-chat', user_id:'third-user-uuid' }
      ],
      chat_messages: []
    };
  });
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2**', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: mockSupabase })
  );
  await page.goto('/chat.html');
  await page.evaluate(() => { window.__mockQueryError = true; });
  await page.locator('#chatUsername').fill('someone');
  await page.locator('#newChatForm button').click();
  await expect(page.locator('#chatToast')).toContainText('lookup failed');
  expect(await page.evaluate(() => window.__mockCalls.some(call => call.table === 'chats' && call.op === 'insert'))).toBe(false);
});
