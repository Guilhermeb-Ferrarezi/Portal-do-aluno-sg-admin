import { expect, test, type Page } from "@playwright/test";

function makeFakeJwt() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(
    JSON.stringify({
      sub: "1",
      usuario: "admin.observability",
      role: 3,
      iat: now,
      exp: now + 60 * 60,
    })
  ).toString("base64url");
  return `${header}.${body}.fakesig`;
}

async function seedSession(page: Page) {
  await page.addInitScript(({ token }: { token: string }) => {
    localStorage.setItem("token", token);
    localStorage.setItem("refreshToken", "observability-refresh");
    localStorage.setItem("nome", "Luana");
  }, { token: makeFakeJwt() });
}

function buildMonitoringText() {
  return [
    'portal_do_aluno_api_http_requests_total{route="/auth/login",method="POST",status_class="2xx"} 310',
    'portal_do_aluno_api_http_requests_total{route="/presence/heartbeat",method="POST",status_class="2xx"} 840',
    'portal_do_aluno_api_http_requests_total{route="/activity-logs",method="GET",status_class="2xx"} 120',
    'portal_do_aluno_api_http_requests_total{route="/metrics",method="GET",status_class="2xx"} 22',
    'portal_do_aluno_api_http_requests_total{route="/exercicios",method="POST",status_class="2xx"} 156',
    'portal_do_aluno_api_http_request_errors_total{route="/auth/login",method="POST",status_class="5xx"} 4',
    'portal_do_aluno_api_http_request_errors_total{route="/presence/heartbeat",method="POST",status_class="5xx"} 2',
    'portal_do_aluno_api_http_request_errors_total{route="/activity-logs",method="GET",status_class="5xx"} 1',
    'portal_do_aluno_api_http_request_errors_total{route="/metrics",method="GET",status_class="5xx"} 0',
    'portal_do_aluno_api_http_request_errors_total{route="/exercicios",method="POST",status_class="4xx"} 3',
    'portal_do_aluno_api_http_request_duration_ms_sum{route="/auth/login"} 24800',
    'portal_do_aluno_api_http_request_duration_ms_sum{route="/presence/heartbeat"} 71200',
    'portal_do_aluno_api_http_request_duration_ms_sum{route="/activity-logs"} 16800',
    'portal_do_aluno_api_http_request_duration_ms_sum{route="/metrics"} 2200',
    'portal_do_aluno_api_http_request_duration_ms_sum{route="/exercicios"} 38200',
    'portal_do_aluno_api_http_request_duration_ms_count{route="/auth/login"} 310',
    'portal_do_aluno_api_http_request_duration_ms_count{route="/presence/heartbeat"} 840',
    'portal_do_aluno_api_http_request_duration_ms_count{route="/activity-logs"} 120',
    'portal_do_aluno_api_http_request_duration_ms_count{route="/metrics"} 22',
    'portal_do_aluno_api_http_request_duration_ms_count{route="/exercicios"} 156',
    'portal_do_aluno_api_http_request_duration_ms_bucket{le="50"} 320',
    'portal_do_aluno_api_http_request_duration_ms_bucket{le="100"} 720',
    'portal_do_aluno_api_http_request_duration_ms_bucket{le="250"} 1080',
    'portal_do_aluno_api_http_request_duration_ms_bucket{le="500"} 1230',
    'portal_do_aluno_api_http_request_duration_ms_bucket{le="1000"} 1444',
    'portal_do_aluno_api_http_request_duration_ms_bucket{le="+Inf"} 1451',
  ].join("\n");
}

async function installMocks(page: Page) {
  await page.route(
    (url) => {
      try {
        return new URL(url).pathname.startsWith("/api/");
      } catch {
        return false;
      }
    },
    async (route) => {
      const requestUrl = new URL(route.request().url());
      const pathname = requestUrl.pathname;

      if (pathname.endsWith("/presence/socket-ticket")) {
        await route.fulfill({ json: { ticket: "playwright-ticket" } });
        return;
      }

      if (pathname.endsWith("/users/me")) {
        await route.fulfill({
          json: {
            id: "1",
            nome: "Luana",
            usuario: "luana",
            email: "luana@example.com",
            role: "admin",
            profilePictureUrl: null,
          },
        });
        return;
      }

      if (pathname.endsWith("/turmas")) {
        await route.fulfill({ json: [] });
        return;
      }

      if (pathname.endsWith("/metrics")) {
        await route.fulfill({
          status: 200,
          contentType: "text/plain",
          body: buildMonitoringText(),
        });
        return;
      }

      if (pathname.endsWith("/activity-logs")) {
        await route.fulfill({
          json: {
            items: [
              {
                id: "obs-1",
                actor: {
                  id: "1",
                  name: "Luana",
                  email: "luana@example.com",
                  role: "admin",
                },
                action: "login_failed",
                entityType: "auth",
                entityId: null,
                method: "POST",
                endpoint: "/auth/login",
                requestBody: { usuario: "luana" },
                responseBody: { message: "Credenciais invalidas" },
                statusCode: 401,
                responseTimeMs: 122,
                requestId: "obs-r1",
                route: "/api/auth/login",
                outcome: "denied",
                errorType: "Client Error",
                source: "dashboard",
                contextArea: "auth",
                metadata: null,
                ipAddress: "172.20.0.1",
                userAgent: "Mozilla/5.0",
                createdAt: "2026-04-16T19:56:00.000Z",
              },
              {
                id: "obs-2",
                actor: {
                  id: "1",
                  name: "Luana",
                  email: "luana@example.com",
                  role: "admin",
                },
                action: "token_refresh",
                entityType: "auth",
                entityId: null,
                method: "POST",
                endpoint: "/auth/refresh",
                requestBody: {},
                responseBody: { ok: true },
                statusCode: 200,
                responseTimeMs: 88,
                requestId: "obs-r2",
                route: "/api/auth/refresh",
                outcome: "success",
                errorType: null,
                source: "dashboard",
                contextArea: "auth",
                metadata: null,
                ipAddress: "172.20.0.1",
                userAgent: "Mozilla/5.0",
                createdAt: "2026-04-16T19:58:00.000Z",
              },
            ],
            total: 2,
          },
        });
        return;
      }

      await route.fulfill({ json: {} });
    }
  );
}

test.describe("observability", () => {
  test("renders operational first fold and payload dialog", async ({ page }) => {
    await seedSession(page);
    await installMocks(page);
    await page.setViewportSize({ width: 1440, height: 1400 });

    await page.goto("/dashboard/sistema/observabilidade");

    await expect(page.getByRole("heading", { name: /Observabilidade da API em primeiro plano/i })).toBeVisible();
    await expect(page.getByText(/Ultima leitura/i)).toBeVisible();
    await expect(page.getByText(/Ritmo recente/i)).toBeVisible();
    await expect(page.getByText(/Rotas criticas/i).first()).toBeVisible();
    await expect(page.getByText(/Rotas mais acionadas/i)).toBeVisible();

    await page.getByRole("button", { name: /Ver payload/i }).first().click();
    await expect(page.getByText(/Payload do log/i)).toBeVisible();
    await expect(page.getByText(/"message": "Credenciais invalidas"/i)).toBeVisible();
  });
});
