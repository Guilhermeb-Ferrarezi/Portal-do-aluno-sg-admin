import { expect, test } from "@playwright/test";

const RECOVERY_ROUTE = "/recuperar-senha";
const STORAGE_KEY = "password-reset-last-request-at";

test.describe("password recovery", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((storageKey) => {
      window.localStorage.removeItem(storageKey);
    }, STORAGE_KEY);
  });

  test("renders the recovery form and validates required input", async ({ page }) => {
    await page.goto(RECOVERY_ROUTE);

    await expect(page.getByText(/^Recuperar senha$/i)).toBeVisible();
    await expect(page.locator("#password-recovery-identifier")).toBeVisible();

    await page.getByRole("button", { name: /Gerar link de recuperacao/i }).click();

    await expect(page.getByText(/Informe seu e-mail ou usuario\./i)).toBeVisible();
  });

  test("blocks invalid email syntax before sending the request", async ({ page }) => {
    let requestCount = 0;

    await page.route("**/api/auth/password-reset/request", async (route) => {
      requestCount += 1;
      await route.continue();
    });

    await page.goto(RECOVERY_ROUTE);
    await page.locator("#password-recovery-identifier").fill("email-invalido@");
    await page.getByRole("button", { name: /Gerar link de recuperacao/i }).click();

    await expect(page.getByText(/Informe um e-mail valido\./i)).toBeVisible();
    expect(requestCount).toBe(0);
  });

  test("starts a resend countdown after requesting a reset email", async ({ page }) => {
    let requestCount = 0;

    await page.route("**/api/auth/password-reset/request", async (route) => {
      requestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Enviamos as instrucoes para redefinir a senha para o e-mail cadastrado.",
        }),
      });
    });

    await page.goto(RECOVERY_ROUTE);
    await page.locator("#password-recovery-identifier").fill("aluno@santos-tech.com");
    await page.getByRole("button", { name: /Gerar link de recuperacao/i }).click();

    await expect(page.getByText(/enviamos as instrucoes para redefinir a senha/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Reenviar em 60s|Reenviar em 59s/i })).toBeDisabled();
    await expect(
      page.getByText(/Aguarde (60|59)s para solicitar outro e-mail de redefinicao\./i)
    ).toBeVisible();
    expect(requestCount).toBe(1);
  });

  test("shows an error when the email or user does not exist and keeps submit enabled", async ({ page }) => {
    await page.route("**/api/auth/password-reset/request", async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Nao encontramos uma conta com esse e-mail ou usuario.",
        }),
      });
    });

    await page.goto(RECOVERY_ROUTE);
    await page.locator("#password-recovery-identifier").fill("naoexiste@santos-tech.com");
    await page.getByRole("button", { name: /Gerar link de recuperacao/i }).click();

    await expect(page.getByText(/Nao encontramos uma conta com esse e-mail ou usuario\./i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Gerar link de recuperacao/i })).toBeEnabled();
    await expect(
      page.getByText(/Voce pode pedir um novo e-mail se o link anterior expirar\./i)
    ).toBeVisible();
  });

  test("re-enables the submit button after the cooldown expires", async ({ page }) => {
    const expiredTimestamp = Date.now() - 61_000;

    await page.addInitScript(
      ({ storageKey, timestamp }) => {
        window.localStorage.setItem(storageKey, String(timestamp));
      },
      { storageKey: STORAGE_KEY, timestamp: expiredTimestamp }
    );

    await page.goto(RECOVERY_ROUTE);

    await expect(page.getByRole("button", { name: /Gerar link de recuperacao|Enviar outro e-mail/i })).toBeEnabled();
    await expect(
      page.getByText(/Voce pode pedir um novo e-mail se o link anterior expirar\./i)
    ).toBeVisible();
  });
});
