const { test, expect } = require('@playwright/test');

test('profile preferences expose all 60 languages and automatic detection controls', async ({ request }) => {
  const response = await request.get('/profile.html');
  expect(response.ok()).toBeTruthy();
  const html = await response.text();
  const select = html.match(/<select id="preferredLanguage">([\\s\\S]*?)<\\/select>/);
  expect(select).not.toBeNull();
  expect([...select[1].matchAll(/<option value="/g)]).toHaveLength(60);
  expect(html).toContain('id="autoDetectLanguage"');
  expect(html).toContain('id="autoDetectRegion"');
});

test('legacy messages table is not used by the current chat page scripts', async ({ request }) => {
  const [servicesResponse, chatResponse] = await Promise.all([
    request.get('/services.js'),
    request.get('/chat.js'),
  ]);
  expect(servicesResponse.ok()).toBeTruthy();
  expect(chatResponse.ok()).toBeTruthy();
  const services = await servicesResponse.text();
  const chat = await chatResponse.text();
  expect(services).toContain("from('direct_messages')");
  expect(chat).toContain("from('chat_messages')");
  expect(services).not.toContain("from('messages')");
  expect(chat).not.toContain("from('messages')");
});
