import { expect, test } from "@playwright/test";

test("redirects anonymous users to login from dashboard @smoke", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator("#login-usuario")).toBeVisible();
  await expect(page.locator("#login-senha")).toBeVisible();
});

test("renders the login form shell @smoke", async ({ page }) => {
  await page.goto("/login");

  await expect(page.locator("#login-usuario")).toBeVisible();
  await expect(page.locator("#login-senha")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Entrar$/i })).toBeDisabled();
});
