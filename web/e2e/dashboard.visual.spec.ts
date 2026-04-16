import { expect, test, type Page } from "@playwright/test";

function makeFakeJwt(role: 1 | 2 | 3) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(
    JSON.stringify({
      sub: "1",
      usuario: `visual-${role}`,
      role,
      iat: now,
      exp: now + 60 * 60,
    })
  ).toString("base64url");
  return `${header}.${body}.fakesig`;
}

async function seedSession(page: Page, role: 1 | 2 | 3, name: string) {
  const token = makeFakeJwt(role);
  await page.addInitScript(
    ({ seededToken, nome }: { seededToken: string; nome: string }) => {
      localStorage.setItem("token", seededToken);
      localStorage.setItem("refreshToken", "dashboard-visual-refresh");
      localStorage.setItem("nome", nome);
    },
    { seededToken: token, nome: name }
  );
}

function buildExercises() {
  return [
    {
      id: "101",
      titulo: "Lista 04 - Estruturas de Repeticao",
      descricao: "Pratique loops e padroes de iteracao.",
      modulo: "Logica",
      tema: "Loops",
      prazo: "2026-04-18T18:00:00.000Z",
      publishedAt: "2026-04-15T13:00:00.000Z",
      createdAt: "2026-04-14T09:00:00.000Z",
    },
    {
      id: "102",
      titulo: "Projeto Final - API REST",
      descricao: "Estruture endpoints e contrato de respostas.",
      modulo: "Backend",
      tema: "REST",
      prazo: "2026-04-22T18:00:00.000Z",
      publishedAt: "2026-04-22T12:00:00.000Z",
      createdAt: "2026-04-14T09:10:00.000Z",
    },
    {
      id: "103",
      titulo: "Quiz - Banco de Dados",
      descricao: "Revise joins, filtros e modelagem.",
      modulo: "Banco de Dados",
      tema: "SQL",
      prazo: null,
      publishedAt: null,
      createdAt: "2026-04-14T09:20:00.000Z",
    },
    {
      id: "104",
      titulo: "Lista 03 - Funcoes em Python",
      descricao: "Assinaturas, retorno e organizacao.",
      modulo: "Python",
      tema: "Funcoes",
      prazo: "2026-04-15T18:00:00.000Z",
      publishedAt: "2026-04-10T12:00:00.000Z",
      createdAt: "2026-04-10T10:00:00.000Z",
    },
    {
      id: "105",
      titulo: "Laboratorio - Git e GitHub",
      descricao: "Fluxos de branch, commit e pull request.",
      modulo: "Ferramentas",
      tema: "Git",
      prazo: "2026-04-25T18:00:00.000Z",
      publishedAt: "2026-04-25T13:00:00.000Z",
      createdAt: "2026-04-15T15:00:00.000Z",
    },
    {
      id: "106",
      titulo: "Avaliacao Bimestral",
      descricao: "Consolidacao de conteudo.",
      modulo: "Geral",
      tema: "Revisao",
      prazo: null,
      publishedAt: null,
      createdAt: "2026-04-15T16:00:00.000Z",
    },
  ];
}

function buildSubmissions() {
  return [
    {
      id: "s1",
      exercicioId: "101",
      alunoId: "201",
      resposta: "ok",
      tipoResposta: "texto",
      linguagem: null,
      nota: null,
      corrigida: false,
      feedbackProfessor: null,
      createdAt: "2026-04-16T08:20:00.000Z",
    },
    {
      id: "s2",
      exercicioId: "104",
      alunoId: "202",
      resposta: "ok",
      tipoResposta: "texto",
      linguagem: null,
      nota: 8,
      corrigida: true,
      feedbackProfessor: null,
      createdAt: "2026-04-16T10:15:00.000Z",
    },
    {
      id: "s3",
      exercicioId: "105",
      alunoId: "203",
      resposta: "ok",
      tipoResposta: "texto",
      linguagem: null,
      nota: null,
      corrigida: false,
      feedbackProfessor: null,
      createdAt: "2026-04-16T11:05:00.000Z",
    },
    {
      id: "s4",
      exercicioId: "103",
      alunoId: "204",
      resposta: "ok",
      tipoResposta: "texto",
      linguagem: null,
      nota: 7,
      corrigida: true,
      feedbackProfessor: null,
      createdAt: "2026-04-15T14:30:00.000Z",
    },
  ];
}

function buildMonitoringText() {
  return [
    'portal_do_aluno_api_http_requests_total{route="/auth/login",method="POST",status_class="2xx"} 310',
    'portal_do_aluno_api_http_requests_total{route="/presence/heartbeat",method="POST",status_class="2xx"} 840',
    'portal_do_aluno_api_http_requests_total{route="/activity-logs",method="GET",status_class="2xx"} 120',
    'portal_do_aluno_api_http_requests_total{route="/metrics",method="GET",status_class="2xx"} 22',
    'portal_do_aluno_api_http_request_errors_total{route="/auth/login",method="POST",status_class="5xx"} 4',
    'portal_do_aluno_api_http_request_errors_total{route="/presence/heartbeat",method="POST",status_class="5xx"} 2',
    'portal_do_aluno_api_http_request_errors_total{route="/activity-logs",method="GET",status_class="5xx"} 0',
    'portal_do_aluno_api_http_request_errors_total{route="/metrics",method="GET",status_class="5xx"} 0',
    'portal_do_aluno_api_http_request_duration_ms_sum{route="/auth/login"} 24800',
    'portal_do_aluno_api_http_request_duration_ms_sum{route="/presence/heartbeat"} 71200',
    'portal_do_aluno_api_http_request_duration_ms_sum{route="/activity-logs"} 16800',
    'portal_do_aluno_api_http_request_duration_ms_sum{route="/metrics"} 2200',
    'portal_do_aluno_api_http_request_duration_ms_count{route="/auth/login"} 310',
    'portal_do_aluno_api_http_request_duration_ms_count{route="/presence/heartbeat"} 840',
    'portal_do_aluno_api_http_request_duration_ms_count{route="/activity-logs"} 120',
    'portal_do_aluno_api_http_request_duration_ms_count{route="/metrics"} 22',
    'portal_do_aluno_api_http_request_duration_ms_bucket{le="50"} 320',
    'portal_do_aluno_api_http_request_duration_ms_bucket{le="100"} 720',
    'portal_do_aluno_api_http_request_duration_ms_bucket{le="250"} 1080',
    'portal_do_aluno_api_http_request_duration_ms_bucket{le="500"} 1230',
    'portal_do_aluno_api_http_request_duration_ms_bucket{le="1000"} 1288',
    'portal_do_aluno_api_http_request_duration_ms_bucket{le="+Inf"} 1292',
  ].join("\n");
}

async function installDashboardMocks(page: Page, userRole: "admin" | "professor" | "aluno") {
  const exercises = buildExercises();
  const submissions = buildSubmissions();

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

      if (pathname.endsWith("/turmas/meus-responsaveis/count")) {
        await route.fulfill({ json: { total: 8 } });
        return;
      }

      if (pathname.endsWith("/turmas/total")) {
        await route.fulfill({ json: { total: 13 } });
        return;
      }

      if (pathname.endsWith("/turmas/alunos/count")) {
        await route.fulfill({ json: { total: 142, totalSistema: 327 } });
        return;
      }

      if (pathname.endsWith("/turmas")) {
        if (!search.has("page") && !search.has("limit") && !search.has("q")) {
          await route.fulfill({
            json: [
              { id: "t1", nome: "Turma A", tipo: "turma", categoria: "informatica", professorId: "2", descricao: null, ativo: true, createdAt: "2026-04-01T00:00:00.000Z" },
              { id: "t2", nome: "Turma B", tipo: "turma", categoria: "programacao", professorId: "2", descricao: null, ativo: true, createdAt: "2026-04-02T00:00:00.000Z" },
            ],
          });
          return;
        }

        await route.fulfill({
          json: {
            items: [{ id: "t1", nome: "Turma A", tipo: "turma", categoria: "informatica", professorId: "2", descricao: null, ativo: true, createdAt: "2026-04-01T00:00:00.000Z" }],
            total: 1,
            pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
          },
        });
        return;
      }

      if (pathname.endsWith("/exercicios")) {
        const status = search.get("status");
        if (!status && !search.has("page") && !search.has("limit")) {
          await route.fulfill({ json: exercises });
          return;
        }

        const items =
          status === "programado"
            ? exercises.filter((item) => item.publishedAt && new Date(item.publishedAt) > new Date("2026-04-16T12:00:00.000Z"))
            : status === "publicado"
              ? exercises.filter((item) => item.publishedAt && new Date(item.publishedAt) <= new Date("2026-04-16T12:00:00.000Z"))
              : status === "rascunho"
                ? exercises.filter((item) => !item.publishedAt)
                : exercises;

        await route.fulfill({
          json: {
            items,
            total: items.length,
            pagination: { page: 1, limit: Number(search.get("limit") ?? items.length), total: items.length, totalPages: 1 },
          },
        });
        return;
      }

      if (pathname.endsWith("/minhas-submissoes")) {
        await route.fulfill({ json: submissions });
        return;
      }

      if (pathname.endsWith("/users/me")) {
        await route.fulfill({
          json: {
            id: "1",
            nome: userRole === "professor" ? "Prof. Luana" : "Luana",
            usuario: "luana",
            email: "luana@example.com",
            role: userRole,
            profilePictureUrl: null,
          },
        });
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
                id: "a1",
                actor: { id: "201", name: "Ana Beatriz Silva", email: null, role: "aluno" },
                action: "submission_create",
                entityType: "submission",
                entityId: "s1",
                method: "POST",
                endpoint: "/submissoes",
                requestBody: null,
                responseBody: null,
                statusCode: 200,
                responseTimeMs: 120,
                requestId: "r1",
                route: "/submissoes",
                outcome: "success",
                errorType: null,
                source: "web",
                contextArea: "dashboard",
                metadata: null,
                ipAddress: null,
                userAgent: null,
                createdAt: "2026-04-16T11:55:00.000Z",
              },
              {
                id: "a2",
                actor: { id: "202", name: "Carlos Mendes", email: null, role: "aluno" },
                action: "exercise_complete",
                entityType: "exercise",
                entityId: "102",
                method: "POST",
                endpoint: "/exercicios/102",
                requestBody: null,
                responseBody: null,
                statusCode: 200,
                responseTimeMs: 110,
                requestId: "r2",
                route: "/exercicios/102",
                outcome: "success",
                errorType: null,
                source: "web",
                contextArea: "dashboard",
                metadata: null,
                ipAddress: null,
                userAgent: null,
                createdAt: "2026-04-16T11:42:00.000Z",
              },
              {
                id: "a3",
                actor: { id: "203", name: "Julia Ferreira", email: null, role: "aluno" },
                action: "submission_create",
                entityType: "submission",
                entityId: "s3",
                method: "POST",
                endpoint: "/submissoes",
                requestBody: null,
                responseBody: null,
                statusCode: 200,
                responseTimeMs: 118,
                requestId: "r3",
                route: "/submissoes",
                outcome: "success",
                errorType: null,
                source: "web",
                contextArea: "dashboard",
                metadata: null,
                ipAddress: null,
                userAgent: null,
                createdAt: "2026-04-16T11:25:00.000Z",
              },
            ],
            total: 3,
          },
        });
        return;
      }

      if (pathname.endsWith("/notifications/dispatches")) {
        await route.fulfill({
          json: {
            items: [
              {
                id: 1,
                templateId: 12,
                templateName: "Lembrete semanal",
                triggeredByActorName: "Luana",
                triggeredByActorEmail: null,
                cursoIds: [1],
                turmaIds: [1, 2],
                alunoIds: [],
                totalRecipients: 92,
                failedRecipients: 0,
                createdAt: "2026-04-16T10:45:00.000Z",
              },
              {
                id: 2,
                templateId: 13,
                templateName: "Aula ao vivo",
                triggeredByActorName: "Luana",
                triggeredByActorEmail: null,
                cursoIds: [1],
                turmaIds: [3],
                alunoIds: [],
                totalRecipients: 48,
                failedRecipients: 0,
                createdAt: "2026-04-16T09:10:00.000Z",
              },
            ],
            total: 2,
            pagination: { page: 1, limit: 5, total: 2, totalPages: 1 },
          },
        });
        return;
      }

      await route.fulfill({ json: {} });
    }
  );
}

async function openDashboard(page: Page, role: 1 | 2 | 3, name: string, userRole: "admin" | "professor" | "aluno") {
  await seedSession(page, role, name);
  await installDashboardMocks(page, userRole);
  await page.goto("/dashboard");
}

test.describe("dashboard visual", () => {
  test("professor desktop first fold", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await openDashboard(page, 2, "Prof. Luana", "professor");

    await expect(page.getByRole("heading", { name: /Bem-vindo de volta, Prof. Luana/i })).toBeVisible();
    await expect(page.getByText(/Resumo operacional/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Exercicios recentes/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Saude operacional/i })).toBeVisible();
  });

  test("admin desktop renders activity feed", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1600 });
    await openDashboard(page, 3, "Luana", "admin");

    await expect(page.getByRole("heading", { name: /Bem-vindo de volta, Luana/i })).toBeVisible();
    await expect(page.getByText(/Atividade de alunos/i)).toBeVisible();
    await expect(page.getByText(/Ana Beatriz Silva enviou uma submissao/i)).toBeVisible();
  });

  test("professor mobile keeps core sections reachable", async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 1200 });
    await openDashboard(page, 2, "Prof. Luana", "professor");

    await expect(page.getByRole("heading", { name: /Bem-vindo de volta, Prof. Luana/i })).toBeVisible();
    await expect(page.getByText(/Turmas geridas/i)).toBeVisible();
    await expect(page.getByText(/Acoes rapidas/i)).toBeVisible();
  });
});
