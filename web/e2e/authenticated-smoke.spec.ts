import { expect, test } from "@playwright/test";
import { loginViaUi, readLoginCredentials } from "./support/auth";

const credentials = readLoginCredentials();

test.describe("authenticated smoke", () => {
  test.skip(!credentials, "Set PLAYWRIGHT_USERNAME and PLAYWRIGHT_PASSWORD to run authenticated smoke tests.");

  test("loads the dashboard after login @smoke", async ({ page }) => {
    await loginViaUi(page, credentials!);

    await expect(page.getByText("Acoes rapidas")).toBeVisible();
    await expect(page.getByRole("button", { name: /Exercicios/i })).toBeVisible();
  });

  test("allows logging out from settings @smoke", async ({ page }) => {
    await loginViaUi(page, credentials!);

    await page.getByRole("button", { name: /Configuracoes/i }).click();
    await page.getByRole("button", { name: /^Sair$/i }).first().click();
    await expect(page.getByRole("dialog", { name: /Sair da conta/i })).toBeVisible();
    await page.getByRole("button", { name: /^Sair$/i }).last().click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: /Entrar/i })).toBeVisible();
  });
});
