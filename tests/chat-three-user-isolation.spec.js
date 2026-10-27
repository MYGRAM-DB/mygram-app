const { test, expect } = require('@playwright/test');

// This is a deterministic client/API-boundary simulation. The route handler models
// the expected RLS outcomes; it does NOT execute policies in the live Supabase project.
test('three-user direct-message flow: A sends, B reads/replies, C cannot read the thread', async ({ page, baseURL }) => {
  const threadId = 'thread-a-b';
  const messages = [];
  const users = {
    tokenA: { id: 'user-a', allowedThreads: [threadId] },
    tokenB: { id: 'user-b', allowedThreads: [threadId] },
    tokenC: { id: 'user-c', allowedThreads: [] }
  };

  await page.route('**/rest/v1/chat_messages**', async route => {
    const request = route.request();
    const auth = request.headers()['authorization'] || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    const user = users[token];
    if (!user) {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Unauthorized' }) });
      return;
    }

    if (request.method() === 'POST') {
      const payload = request.postDataJSON();
      if (!user.allowedThreads.includes(payload.chat_id) || payload.sender_id !== user.id) {
        await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'Forbidden' }) });
        return;
      }
      const saved = { id: `message-${messages.length + 1}`, ...payload };
      messages.push(saved);
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([saved]) });
      return;
    }

    if (request.method() === 'GET') {
      const url = new URL(request.url());
      const chatId = url.searchParams.get('chat_id')?.replace(/^eq\./, '');
      const visible = user.allowedThreads.includes(chatId)
        ? messages.filter(message => message.chat_id === chatId)
        : [];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(visible) });
      return;
    }

    await route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ message: 'Method not allowed' }) });
  });

  await page.goto(baseURL);

  const apiCall = (token, method, payload) => page.evaluate(async ({ token, method, payload }) => {
    const url = new URL('/rest/v1/chat_messages', window.location.origin);
    if (method === 'GET') url.searchParams.set('chat_id', 'eq.thread-a-b');
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(method === 'POST' ? { Prefer: 'return=representation' } : {})
      },
      ...(payload ? { body: JSON.stringify(payload) } : {})
    });
    return { status: response.status, body: await response.json() };
  }, { token, method, payload });

  const sent = await apiCall('tokenA', 'POST', {
    chat_id: threadId,
    sender_id: 'user-a',
    content: 'Hello B'
  });
  expect(sent.status).toBe(201);
  expect(sent.body[0].content).toBe('Hello B');

  const receivedByB = await apiCall('tokenB', 'GET');
  expect(receivedByB.status).toBe(200);
  expect(receivedByB.body).toHaveLength(1);
  expect(receivedByB.body[0].content).toBe('Hello B');

  const reply = await apiCall('tokenB', 'POST', {
    chat_id: threadId,
    sender_id: 'user-b',
    content: 'Hi A'
  });
  expect(reply.status).toBe(201);

  const receivedByA = await apiCall('tokenA', 'GET');
  expect(receivedByA.body.map(message => message.content)).toEqual(['Hello B', 'Hi A']);

  const deniedByPolicyModel = await apiCall('tokenC', 'GET');
  expect(deniedByPolicyModel.status).toBe(200);
  expect(deniedByPolicyModel.body).toEqual([]);

  const forgedSender = await apiCall('tokenC', 'POST', {
    chat_id: threadId,
    sender_id: 'user-a',
    content: 'forged'
  });
  expect(forgedSender.status).toBe(403);
});
