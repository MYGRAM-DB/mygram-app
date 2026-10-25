const { test, expect } = require('@playwright/test');

const mockSupabase = `
window.supabase = { createClient: () => ({
  auth: {
    getSession: async () => ({ data: { session: { user: { id: 'test-user-uuid', email: 'tester@example.com' } } }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
  },
  from: (table) => {
    const query = {
      select() { return this; }, eq() { return this; }, in() { return this; }, order() { return this; },
      then(resolve, reject) { return Promise.resolve({ data: [], error: null }).then(resolve, reject); }
    };
    return query;
  },
  storage: { from: () => ({ upload: async () => ({ data: { path: 'voice-note.webm' }, error: null }), createSignedUrl: async () => ({ data: { signedUrl: 'https://example.test/voice.webm' }, error: null }) }) }
}) };
`;

test('standalone chat exposes an accessible voice-note recorder', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2**', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: mockSupabase })
  );
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] })
    }});
    window.MediaRecorder = class {
      constructor() { this.state = 'inactive'; this.mimeType = 'audio/webm'; }
      start() { this.state = 'recording'; this.ondataavailable?.({ data: new Blob(['voice sample'], { type: 'audio/webm' }) }); }
      stop() { this.state = 'inactive'; this.onstop?.(); }
    };
  });
  await page.goto('/chat.html');
  const record = page.locator('#recordVoiceButton');
  await expect(record).toBeVisible();
  await record.click();
  await expect(record).toContainText('إيقاف التسجيل');
  await expect(record).toHaveAttribute('aria-pressed', 'true');
  await record.click();
  await expect(page.locator('#voiceRecordingStatus')).toContainText('تم تجهيز التسجيل الصوتي للإرسال');
  await expect(record).toHaveAttribute('aria-pressed', 'false');
});
