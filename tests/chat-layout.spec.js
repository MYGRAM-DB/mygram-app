const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2**', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.supabase={createClient:()=>({})};' })
  );
  await page.route('**/auth-guard.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.route('**/chat.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.route('**/notifications.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
});

test('Messenger shows the conversation list beside the active thread on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/chat.html');
  const sidebar = page.locator('.chat-layout > .chat-sidebar');
  const thread = page.locator('.chat-layout > .chat-thread-panel');
  await expect(sidebar).toBeVisible();
  await expect(thread).toBeVisible();
  const sideBox = await sidebar.boundingBox();
  const threadBox = await thread.boundingBox();
  expect(sideBox).not.toBeNull();
  expect(threadBox).not.toBeNull();
  expect(sideBox.x + sideBox.width).toBeLessThanOrEqual(threadBox.x + 2);
});

test('Messenger stacks its panels and uses a dark-first surface on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/chat.html');
  const sidebar = page.locator('.chat-layout > .chat-sidebar');
  const thread = page.locator('.chat-layout > .chat-thread-panel');
  await expect(sidebar).toBeVisible();
  await expect(thread).toBeVisible();
  const sideBox = await sidebar.boundingBox();
  const threadBox = await thread.boundingBox();
  expect(sideBox).not.toBeNull();
  expect(threadBox).not.toBeNull();
  expect(threadBox.y).toBeGreaterThanOrEqual(sideBox.y + sideBox.height);
  await expect.poll(() => page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(11, 18, 32)');
});
