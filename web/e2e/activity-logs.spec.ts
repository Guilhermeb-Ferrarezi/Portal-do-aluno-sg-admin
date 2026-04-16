import { expect, test, type Page } from "@playwright/test";

function makeFakeJwt() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(
    JSON.stringify({
      sub: "1",
      usuario: "admin.logs",
      role: 3,
      iat: now,
      exp: now + 60 * 60,
    })
  ).toString("base64url");
  return `${header}.${body}.fakesig`;
}

async function seedSession(page: Page) {
  const token = makeFakeJwt();
  await page.addInitScript(({ seededToken }: { seededToken: string }) => {
    localStorage.setItem("token", seededToken);
    localStorage.setItem("refreshToken", "activity-logs-refresh");
    localStorage.setItem("nome", "Luana");
  }, { seededToken: token });
}

async function installActivityLogMocks(page: Page) {
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
      const search = requestUrl.searchParams;

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
        if (!search.has("page") && !search.has("limit") && !search.has("q")) {
          await route.fulfill({
            json: [
              {
                id: "t1",
                nome: "Turma A",
                tipo: "turma",
                categoria: "informatica",
                professorId: "2",
                descricao: null,
                ativo: true,
                createdAt: "2026-04-01T00:00:00.000Z",
              },
            ],
          });
          return;
        }

        await route.fulfill({
          json: {
            items: [],
            total: 0,
            pagination: { page: 1, limit: 1, total: 0, totalPages: 0 },
          },
        });
        return;
      }

      if (pathname.endsWith("/activity-logs")) {
        const actorGroup = search.get("actorGroup");

        if (actorGroup === "staff") {
          await route.fulfill({
            json: {
              items: [
                {
                  id: "log-1",
                  actor: {
                    id: "1",
                    name: "Luana",
                    email: "luana@example.com",
                    role: "admin",
                  },
                  action: "create",
                  entityType: "exercicio",
                  entityId: "99",
                  method: "POST",
                  endpoint: "/exercicios",
                  route: "/api/exercicios",
                  ipAddress: "172.20.0.1",
                  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0",
                  requestId: "de59d512-56ba-4e34-aa3d-07f8aa6954c4",
                  requestBody: {
                    titulo: "OTIUIUIUII",
                    descricao: "KAKAKAKAKAKAKK",
                    phase_id: 17,
                    course_id: 1,
                    modulo: "APIs + Async + UX (Semanas 17-24)",
                    tema: "HTTP e JSON: entendendo requisicoes e consumindo dados externos.",
                    prazo: "2026-04-17T09:06:00.000Z",
                    video_url: null,
                    difficulty: 1,
                    index_order: 1,
                    is_final_exercise: false,
                    is_daily_task: false,
                    points_redeem: 54,
                    exercise_period: "2026-04-16T19:55:41.704Z",
                    publicado: true,
                    published_at: null,
                    categoria: "programacao",
                    tipoExercicio: "escrita",
                    multipla_regras: null,
                    permitir_repeticao: false,
                    max_tentativas: null,
                    penalidade_por_tentativa: 0,
                    intervalo_reenvio: null,
                  },
                  responseBody: {
                    message: "Exercicio criado com sucesso!",
                    exercicio: {
                      id: 99,
                      titulo: "OTIUIUIUII",
                      categoria: "programacao",
                    },
                  },
                  statusCode: 201,
                  responseTimeMs: 142,
                  outcome: "success",
                  errorType: null,
                  source: "dashboard",
                  contextArea: "exercicios",
                  metadata: null,
                  createdAt: "2026-04-16T19:56:00.000Z",
                },
              ],
              total: 1,
            },
          });
          return;
        }

        await route.fulfill({ json: { items: [], total: 0 } });
        return;
      }

      await route.fulfill({ json: {} });
    }
  );
}

test.describe("activity logs", () => {
  test("shows real response payload in response tab for exercise creation logs", async ({ page }) => {
    await seedSession(page);
    await installActivityLogMocks(page);

    await page.goto("/dashboard/sistema/logs");

    await page.getByLabel(/Escopo dos logs/i).selectOption("staff");
    const logRow = page.getByRole("button", { name: /Luana.*exerc/i });
    await expect(logRow).toBeVisible();
    await logRow.click();

    await expect(page.getByRole("button", { name: /^Request$/i })).toBeVisible();
    await expect(page.getByText("/exercicios").first()).toBeVisible();
    await expect(page.getByText(/"titulo": "OTIUIUIUII"/i)).toBeVisible();

    await page.getByRole("button", { name: /^Response$/i }).click();

    await expect(page.getByText(/"message": "Exercicio criado com sucesso!"/i)).toBeVisible();
    await expect(page.getByText(/"statusCode": null/i)).not.toBeVisible();
  });
});
