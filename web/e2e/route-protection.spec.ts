import { expect, test } from "@playwright/test";
import { appRoutes } from "../src/router/routes";

const PROTECTED_ROUTES = [
  appRoutes.dashboard,
  appRoutes.exercicios,
  appRoutes.materiais,
  appRoutes.videoaulas,
  appRoutes.medalhas,
  appRoutes.perfil,
  appRoutes.turmas,
  appRoutes.estruturaCurso.root,
];

for (const route of PROTECTED_ROUTES) {
  test(`redirects anonymous users to login from ${route} @smoke`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator("#login-usuario")).toBeVisible();
  });
}

test("login page is accessible without authentication @smoke", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator("#login-usuario")).toBeVisible();
});

test("already-logged-in user visiting /login is redirected to dashboard", async ({ page }) => {
  // Inject a valid fake session before navigation
  const fakeJwt = buildFakeJwt({ sub: "1", role: 1 });
  await page.addInitScript(
    ({ token, refreshToken }: { token: string; refreshToken: string }) => {
      localStorage.setItem("token", token);
      localStorage.setItem("refreshToken", refreshToken);
    },
    { token: fakeJwt, refreshToken: "fake-refresh-token" }
  );

  await page.route("**/api/**", (route) => route.fulfill({ status: 200, body: "[]" }));
  await page.goto("/login");

  await expect(page).toHaveURL(/\/dashboard$/);
});

function buildFakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fakesig`;
}
