const { test, expect } = require('@playwright/test');

const unresolvedAuthClient = `
window.supabase = {
  createClient: () => ({
    auth: {
      // Simulate a slow auth response so the page stays in its pending state.
      getSession: () => new Promise(() => {})
    }
  })
};
`;

for (const route of ['/home.html', '/people.html', '/profile.html', '/services.html']) {
  test(`private content stays hidden while auth is unresolved on ${route}`, async ({ page }) => {
    await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2**', request =>
      request.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: unresolvedAuthClient
      })
    );

    await page.goto(route);
    await expect(page.locator('html')).toHaveClass(/auth-pending/);
    await expect(page.locator('body')).toHaveCSS('visibility', 'hidden');
  });
}
