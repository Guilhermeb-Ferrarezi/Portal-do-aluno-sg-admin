import { expect, test } from "@playwright/test";
import { setupMockSession } from "./support/auth";

/**
 * Navigation tests use a fake auth session injected via localStorage so that
 * they work without a running API server. All /api/* requests are mocked to
 * return empty arrays.
 *
 * Sidebar visibility requires desktop viewport (set via playwright.config.ts
 * Desktop Chrome device).
 */

test.describe("sidebar navigation", () => {
  test.beforeEach(async ({ page }) => {
    await setupMockSession(page, "professor");
    await page.goto("/dashboard");
  });

  test("dashboard page loads after mock login @smoke", async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("navigation")).toBeVisible();
  });

  test("navigates to Exercicios via sidebar link", async ({ page }) => {
    await page.getByRole("link", { name: /Exercicios/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/exercicios$/);
  });

  test("navigates to Materiais via sidebar link", async ({ page }) => {
    await page.getByRole("link", { name: /Materiais/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/materiais$/);
  });

  test("navigates to Videoaulas via sidebar link", async ({ page }) => {
    await page.getByRole("link", { name: /Videoaulas/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/videoaulas$/);
  });

  test("navigates to Turmas via sidebar link (professor role)", async ({ page }) => {
    await page.getByRole("link", { name: /Turmas/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/turmas$/);
  });

  test("navigates back to Dashboard from a sub-route", async ({ page }) => {
    await page.goto("/dashboard/exercicios");
    await page.getByRole("link", { name: /^Dashboard$/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test.describe("admin navigation", () => {
  test.beforeEach(async ({ page }) => {
    await setupMockSession(page, "admin");
    await page.goto("/dashboard");
  });

  test("admin does not see the Exercicios link", async ({ page }) => {
    await expect(page.getByRole("link", { name: /^Exercicios$/i })).not.toBeVisible();
  });

  test("admin sees the Usuarios menu button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Usuarios/i })).toBeVisible();
  });
});
