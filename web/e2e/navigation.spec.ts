import { expect, test, type Page } from "@playwright/test";
import { setupMockSession } from "./support/auth";

/**
 * Navigation tests use a fake auth session injected via localStorage so that
 * they work without a running API server. All /api/* requests are mocked to
 * return empty arrays.
 *
 * Sidebar visibility requires desktop viewport (set via playwright.config.ts
 * Desktop Chrome device).
 */

async function openArea(page: Page, label: RegExp) {
  const trigger = page.getByRole("button", { name: label });
  const expanded = await trigger.getAttribute("aria-expanded");
  if (expanded !== "true") {
    await trigger.click();
  }
}

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
    await openArea(page, /Conteudo/i);
    await page.getByRole("link", { name: /Exercicios/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/conteudo\/exercicios$/);
  });

  test("navigates to Materiais via sidebar link", async ({ page }) => {
    await openArea(page, /Conteudo/i);
    await page.getByRole("link", { name: /Materiais/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/conteudo\/materiais$/);
  });

  test("navigates to Videoaulas via sidebar link", async ({ page }) => {
    await openArea(page, /Conteudo/i);
    await page.getByRole("link", { name: /Videoaulas/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/conteudo\/videoaulas$/);
  });

  test("navigates to Turmas via sidebar link (professor role)", async ({ page }) => {
    await openArea(page, /Operacao/i);
    await page.getByRole("link", { name: /Turmas/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/operacao\/turmas$/);
  });

  test("navigates back to Dashboard from a sub-route", async ({ page }) => {
    await page.goto("/dashboard/conteudo/exercicios");
    await page.getByRole("link", { name: /^Dashboard$/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test.describe("admin navigation", () => {
  test.beforeEach(async ({ page }) => {
    await setupMockSession(page, "admin");
    await page.goto("/dashboard");
  });

  test("admin sees the Exercicios link inside Conteudo", async ({ page }) => {
    await openArea(page, /Conteudo/i);
    await expect(page.getByRole("link", { name: /^Exercicios$/i })).toBeVisible();
  });

  test("admin sees the Usuarios menu button", async ({ page }) => {
    await openArea(page, /Usuarios/i);
    await expect(page.getByRole("link", { name: /Usuarios/i })).toBeVisible();
  });
});
