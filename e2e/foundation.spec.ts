import { expect, test } from "@playwright/test";

test("Arabic RTL homepage renders all nine registered products", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");

  await expect(page).toHaveTitle("MYGRAM | كل ما تحتاجه هنا");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("heading", { name: "كل عالمك الرقمي يبدأ من هنا." }),
  ).toBeVisible();
  await expect(page.locator(".product-card")).toHaveCount(9);
  await expect(page.getByTestId("product-ai")).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("Messenger and WHATSMYGRAM navigate to distinct product pages", async ({ page }) => {
  await page.goto("/");
  await page.locator('a[href="#/products"]').filter({ hasText: "استكشف المنتجات" }).click();

  await expect(page.getByRole("heading", { name: "مساحات MYGRAM" })).toBeVisible();
  await page.getByTestId("product-messenger").click();
  await expect(page).toHaveURL(/#\/products\/messenger$/);
  await expect(page.getByRole("heading", { name: "MYGRAM MESSENGER" })).toBeVisible();

  await page.getByRole("link", { name: /العودة إلى المنتجات/ }).click();
  await page.getByTestId("product-whatsmygram").click();
  await expect(page).toHaveURL(/#\/products\/whatsmygram$/);
  await expect(page.getByRole("heading", { name: "WHATSMYGRAM" })).toBeVisible();
});

test("theme preference persists after a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "الإعدادات" }).first().click();

  await expect(page.getByRole("heading", { name: "إعدادات التجربة" })).toBeVisible();
  await page.getByRole("button", { name: "فاتح" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("mobile navigation is available without showing the desktop sidebar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.locator(".mobile-nav")).toBeVisible();
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".product-card")).toHaveCount(9);
});

test("signup form stays disabled until Supabase client configuration is supplied", async ({ page }) => {
  await page.goto("/#/auth");

  await expect(page.getByRole("heading", { name: "الدخول إلى MYGRAM" })).toBeVisible();
  await expect(page.getByText("اتصال Supabase غير مُعد").first()).toBeVisible();
  await page.getByRole("button", { name: "مستخدم جديد؟ أنشئ حساباً" }).click();
  await expect(page.locator('input[name="fullName"]')).toBeDisabled();
  await expect(page.getByRole("button", { name: "إنشاء حساب" })).toBeDisabled();
});
