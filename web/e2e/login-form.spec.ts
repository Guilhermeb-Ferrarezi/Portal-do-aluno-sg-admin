import { expect, test } from "@playwright/test";

test.describe("login form behavior", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("submit button is disabled when both fields are empty @smoke", async ({ page }) => {
    await expect(page.getByRole("button", { name: /^Entrar$/i })).toBeDisabled();
  });

  test("submit button stays disabled with only username filled", async ({ page }) => {
    await page.locator("#login-usuario").fill("algumusuario");
    await expect(page.getByRole("button", { name: /^Entrar$/i })).toBeDisabled();
  });

  test("submit button stays disabled with only password filled", async ({ page }) => {
    await page.locator("#login-senha").fill("alguma-senha");
    await expect(page.getByRole("button", { name: /^Entrar$/i })).toBeDisabled();
  });

  test("submit button becomes enabled when both fields are filled", async ({ page }) => {
    await page.locator("#login-usuario").fill("algumusuario");
    await page.locator("#login-senha").fill("alguma-senha");
    await expect(page.getByRole("button", { name: /^Entrar$/i })).toBeEnabled();
  });

  test("password field starts as type=password (masked)", async ({ page }) => {
    await expect(page.locator("#login-senha")).toHaveAttribute("type", "password");
  });

  test("password toggle reveals and re-hides the password", async ({ page }) => {
    await page.locator("#login-senha").fill("minhasenha");

    await page.getByRole("button", { name: /Mostrar senha/i }).click();
    await expect(page.locator("#login-senha")).toHaveAttribute("type", "text");

    await page.getByRole("button", { name: /Ocultar senha/i }).click();
    await expect(page.locator("#login-senha")).toHaveAttribute("type", "password");
  });

  test("shows error and stays on login when credentials are rejected", async ({ page }) => {
    await page.route("**/api/auth/login", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Credenciais invalidas" }),
      })
    );

    await page.locator("#login-usuario").fill("usuario-errado");
    await page.locator("#login-senha").fill("senha-errada");
    await page.getByRole("button", { name: /^Entrar$/i }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator("#login-usuario")).toBeVisible();
  });

  test("does not redirect to dashboard on network error", async ({ page }) => {
    await page.route("**/api/auth/login", (route) => route.abort("failed"));

    await page.locator("#login-usuario").fill("usuario");
    await page.locator("#login-senha").fill("senha");
    await page.getByRole("button", { name: /^Entrar$/i }).click();

    await expect(page).toHaveURL(/\/login$/);
  });
});
