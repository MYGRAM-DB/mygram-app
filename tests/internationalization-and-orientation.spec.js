const { test, expect } = require('@playwright/test');

test('language picker is available on login and supports the currently implemented locales', async ({ page }) => {
  await page.goto('/login.html');
  const picker = page.locator('#mygramLanguage');
  await expect(picker).toBeVisible();
  await expect(picker.locator('option')).toHaveCount(60);
  await picker.selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await picker.selectOption('ar');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await picker.selectOption('si');
  await expect(page.locator('html')).toHaveAttribute('lang', 'si');
  await expect(page.locator('#formTitle')).not.toHaveText('Welcome back 👋');
  await picker.selectOption('hu');
  await expect(page.locator('html')).toHaveAttribute('lang', 'hu');
});

test('login remains usable in portrait and landscape mobile orientations', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login.html');
  await expect(page.locator('#authForm')).toBeVisible();
  await expect(page.locator('#submitButton')).toBeVisible();

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('#authForm')).toBeVisible();
  await expect(page.locator('#submitButton')).toBeVisible();
  const bounds = await page.locator('#submitButton').boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(844);
});

test('password recovery action is visible and does not submit the login form', async ({ page }) => {
  await page.goto('/login.html');
  await page.locator('#loginTab').click();
  const recovery = page.locator('#resetPasswordButton');
  await expect(recovery).toBeVisible();
  await expect(recovery).toHaveAttribute('type', 'button');
});

test('Spanish locale translates core navigation and uses left-to-right layout', async ({ page }) => {
  await page.goto('/login.html');
  await page.locator('#loginTab').click();
  const picker = page.locator('#mygramLanguage');
  await picker.selectOption('es');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('#formTitle')).toContainText('¡Qué bueno verte de nuevo!');
  await picker.selectOption('zh');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh');
  await expect(page.locator('#formTitle')).not.toContainText('¡Qué bueno verte de nuevo!');
  await picker.selectOption('ur');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ur');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await picker.selectOption('uk');
  await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
  await picker.selectOption('fa');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await picker.selectOption('hu');
  await expect(page.locator('html')).toHaveAttribute('lang', 'hu');
});

test('known Arabic interface messages fall back to English rather than leaking Arabic into another locale', async ({ page }) => {
  await page.goto('/login.html');
  await page.evaluate(() => {
    const p = document.createElement('p');
    p.id = 'localeFallbackProbe';
    p.textContent = 'تعذر تحميل التفاعلات:';
    document.body.appendChild(p);
  });
  await page.locator('#mygramLanguage').selectOption('fr');
  await expect(page.locator('#localeFallbackProbe')).toHaveText('Could not load reactions:');
  await page.locator('#mygramLanguage').selectOption('ar');
  await page.evaluate(() => { document.querySelector('#localeFallbackProbe').textContent = 'إرسال'; });
  await page.locator('#mygramLanguage').selectOption('fr');
  await expect(page.locator('#localeFallbackProbe')).toHaveText('Send');
  await page.locator('#mygramLanguage').selectOption('ar');
  await expect(page.locator('#localeFallbackProbe')).toHaveText('إرسال');
});

test('language selection translates placeholders and localizes country names without losing the selected country', async ({ page }) => {
  await page.goto('/login.html');
  await page.locator('#phoneTab').click();
  await page.locator('#phoneCountry').selectOption('NL');
  await page.locator('#mygramLanguage').selectOption('en');
  await expect(page.locator('#password')).toHaveAttribute('placeholder', 'Password');
  await expect(page.locator('#phoneCountry')).toHaveValue('NL');
  await expect(page.locator('#phoneCountry option[value="NL"]')).toContainText('Netherlands');
  await page.locator('#mygramLanguage').selectOption('ar');
  await expect(page.locator('#password')).toHaveAttribute('placeholder', 'أدخل كلمة المرور');
  await expect(page.locator('#phoneCountry option[value="NL"]')).toContainText('هولندا');
});

test('non-Arabic-script locales avoid Arabic-script fragments in the password field', async ({ page }) => {
  await page.goto('/login.html');
  const codes = await page.locator('#mygramLanguage option').evaluateAll(options => options.map(option => option.value));
  expect(codes).toHaveLength(60);
  for (const code of codes.filter(code => !['ar', 'ur', 'fa'].includes(code))) {
    await page.locator('#mygramLanguage').selectOption(code);
    const placeholder = await page.locator('#password').getAttribute('placeholder');
    expect(placeholder, 'password placeholder for ' + code).not.toMatch(/[\u0600-\u06FF]/);
  }
});


test('additional core locales translate the login action without English fallback', async ({ page }) => {
  await page.goto('/login.html');
  await page.locator('#loginTab').click();
  const picker = page.locator('#mygramLanguage');
  const expected = {
    hu: 'Bejelentkezés',
    ca: 'Inicia sessió',
    eu: 'Hasi saioa',
    gl: 'Iniciar sesión',
    is: 'Skrá inn',
    mk: 'Најава',
    sq: 'Hyr',
    bs: 'Prijava',
    ka: 'შესვლა',
    hy: 'Մուտք գործել',
    az: 'Daxil ol',
    ga: 'Logáil isteach',
    cy: 'Mewngofnodi',
    ne: 'लगइन',
    ta: 'உள்நுழைக',
    te: 'లాగిన్ అవ్వండి',
    mr: 'लॉग इन करा',
    am: 'ግባ',
    si: 'පිවිසෙන්න',
  };
  for (const [locale, label] of Object.entries(expected)) {
    await picker.selectOption(locale);
    await expect(page.locator('#submitButton')).toHaveText(label);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  }
});


test('all 60 language choices translate the login action and set writing direction', async ({ page }) => {
  await page.goto('/login.html');
  await page.locator('#loginTab').click();
  const picker = page.locator('#mygramLanguage');
  const locales = await picker.locator('option').evaluateAll(options =>
    options.map(option => option.value).filter(Boolean)
  );
  expect(locales).toHaveLength(60);
  for (const locale of locales) {
    await picker.selectOption(locale);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('html')).toHaveAttribute(
      'dir',
      ['ar', 'ur', 'fa', 'he'].includes(locale) ? 'rtl' : 'ltr'
    );
    if (locale !== 'en') {
      await expect(page.locator('#submitButton')).not.toHaveText('Sign in');
    }
  }
});


test('rapid language changes keep the latest selection after asynchronous catalog loads', async ({ page }) => {
  await page.goto('/login.html');
  const picker = page.locator('#mygramLanguage');
  await expect(picker).toBeVisible();

  await picker.selectOption('si');
  await picker.selectOption('ne');
  await picker.selectOption('fr');

  await expect(picker).toHaveValue('fr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.waitForTimeout(300);
  await expect(picker).toHaveValue('fr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
});

test('a manually selected language is restored after reloading the page', async ({ page }) => {
  await page.goto('/login.html');
  const picker = page.locator('#mygramLanguage');
  await picker.selectOption('fr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

  await page.reload();
  await expect(page.locator('#mygramLanguage')).toHaveValue('fr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
});
