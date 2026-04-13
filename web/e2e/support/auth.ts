import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export type LoginCredentials = {
  username: string;
  password: string;
};

export function readLoginCredentials(): LoginCredentials | null {
  const username = process.env.PLAYWRIGHT_USERNAME?.trim();
  const password = process.env.PLAYWRIGHT_PASSWORD?.trim();

  if (!username || !password) {
    return null;
  }

  return { username, password };
}

export async function loginViaUi(page: Page, credentials: LoginCredentials) {
  await page.goto("/login");

  await page.locator("#login-usuario").fill(credentials.username);
  await page.locator("#login-senha").fill(credentials.password);
  await page.getByRole("button", { name: /^Entrar$/i }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
}

/** Builds a fake (unsigned) JWT that the frontend will accept as a valid non-expired token. */
function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fakesig`;
}

/**
 * Injects a fake auth session via localStorage and mocks all /api/* requests so
 * navigation tests work without a real backend.
 *
 * Role defaults to "professor" (role=2) so that sidebar links for both
 * Exercicios and Turmas are visible.
 */
export async function setupMockSession(
  page: Page,
  role: "aluno" | "professor" | "admin" = "professor"
) {
  const roleNum = { aluno: 1, professor: 2, admin: 3 }[role];
  const fakeToken = makeFakeJwt({ sub: "1", usuario: "testuser", role: roleNum });

  await page.addInitScript(
    ({ token, refreshToken, nome }: { token: string; refreshToken: string; nome: string }) => {
      localStorage.setItem("token", token);
      localStorage.setItem("refreshToken", refreshToken);
      localStorage.setItem("nome", nome);
    },
    { token: fakeToken, refreshToken: "fake-refresh-token", nome: "Aluno Teste" }
  );

  await page.route(
    (url) => {
      try {
        return new URL(url).pathname.startsWith("/api/");
      } catch {
        return false;
      }
    },
    (route) => {
    const method = route.request().method();
    if (method === "GET") {
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    } else {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    }
    }
  );
}
