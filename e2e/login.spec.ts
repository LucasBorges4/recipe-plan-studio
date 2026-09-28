import { test, expect } from "@playwright/test";

test.describe("Login", () => {
  test("deve renderizar a página de login", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/login/i);
  });
});
