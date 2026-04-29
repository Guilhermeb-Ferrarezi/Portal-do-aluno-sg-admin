import { expect, test, type Page } from "@playwright/test";

function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fakesig`;
}

const cr = <T,>(result: T) =>
  JSON.stringify({ success: true, errors: [], result, totalRows: null });

async function setupAuth(page: Page) {
  const token = makeFakeJwt({ sub: "1", usuario: "admin", role: 3 });
  await page.addInitScript(
    ({ t }: { t: string }) => {
      localStorage.setItem("token", t);
      localStorage.setItem("refreshToken", "fake");
      localStorage.setItem("nome", "Admin");
    },
    { t: token }
  );
}

async function mockUsersMe(page: Page) {
  await page.route(
    (url) => {
      try {
        return new URL(url).pathname === "/api/users/me";
      } catch {
        return false;
      }
    },
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "1",
          nome: "Admin",
          email: "admin@test.com",
          role: "admin",
          ativo: true,
          createdAt: "2026-01-01T00:00:00.000Z",
        }),
      })
  );
}

async function mockTurmas(page: Page) {
  await page.route(
    (url) => {
      try {
        return new URL(url).pathname === "/api/turmas";
      } catch {
        return false;
      }
    },
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      })
  );
}

test.describe("Ranking de Pontos", () => {
  test("renderiza pódio e tabela com dados ordenados", async ({ page }) => {
    await setupAuth(page);
    await mockUsersMe(page);
    await mockTurmas(page);

    await page.route(
      (url) => {
        try {
          return new URL(url).pathname.endsWith("/Point/GetRankingPoints");
        } catch {
          return false;
        }
      },
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: cr([
            { userId: 1, totalPoints: 1500, name: "Alice", profilePictureUrl: null },
            { userId: 2, totalPoints: 1200, name: "Bob", profilePictureUrl: null },
            { userId: 3, totalPoints: 900, name: "Carla", profilePictureUrl: null },
            { userId: 4, totalPoints: 600, name: "Daniel", profilePictureUrl: null },
          ]),
        })
    );

    await page.goto("/dashboard/operacao/rankings/pontos");

    await expect(page.getByTestId("podium-1")).toContainText("Alice");
    await expect(page.getByTestId("podium-2")).toContainText("Bob");
    await expect(page.getByTestId("podium-3")).toContainText("Carla");
    await expect(page.getByTestId("ranking-pontos-table")).toContainText("Daniel");
  });
});

test.describe("Ranking de Notas", () => {
  test("alterna entre tabs de categoria e mostra entradas", async ({ page }) => {
    await setupAuth(page);
    await mockUsersMe(page);
    await mockTurmas(page);

    await page.route(
      (url) => {
        try {
          return new URL(url).pathname.endsWith("/Point/RankingCategories");
        } catch {
          return false;
        }
      },
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: cr([
            { id: 1, category: "Matemática" },
            { id: 2, category: "Português" },
          ]),
        })
    );

    await page.route(
      (url) => {
        try {
          return new URL(url).pathname.endsWith("/Point/GetAvailableRankingPerCategory");
        } catch {
          return false;
        }
      },
      (route) => {
        const category = new URL(route.request().url()).searchParams.get("category");
        const rankings =
          category === "Português"
            ? [
                {
                  userId: 2,
                  name: "Pedro",
                  profilePictureUrl: null,
                  percentAvailable: 50,
                  totalAnswers: 5,
                  status: "Em Progresso",
                },
              ]
            : [
                {
                  userId: 1,
                  name: "Ana",
                  profilePictureUrl: null,
                  percentAvailable: 85,
                  totalAnswers: 20,
                  status: "Desbloqueado",
                },
              ];
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: cr([{ category: category ?? "Matemática", rankings }]),
        });
      }
    );

    await page.goto("/dashboard/operacao/rankings/notas");

    await page.getByTestId("categoria-tab-Matemática").click();
    await expect(page.getByTestId("ranking-notas-table")).toContainText("Ana");
    await page.getByTestId("categoria-tab-Português").click();
    await expect(page.getByTestId("ranking-notas-table")).toContainText("Pedro");
  });
});

test.describe("Eventos de Rankings", () => {
  test("lista eventos por tipo e abre modal de cadastro", async ({ page }) => {
    await setupAuth(page);
    await mockUsersMe(page);
    await mockTurmas(page);

    await page.route(
      (url) => {
        try {
          return new URL(url).pathname.endsWith("/Point/GetRankingEvent");
        } catch {
          return false;
        }
      },
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: cr([
            {
              id: 1,
              eventName: "Premiação Janeiro TLGD",
              eventType: "Notas",
              durationMinutes: 4320,
              startTime: "2026-01-28T14:00:00Z",
              endTime: "2026-01-31T14:00:00Z",
              eventRankingAwards: [
                {
                  awardName: "Mochila TLGD",
                  awardPositionRanking: 1,
                  awardDescription: "Primeiro lugar",
                  awardPictureUrl: "",
                },
              ],
            },
          ]),
        })
    );

    await page.route(
      (url) => {
        try {
          return new URL(url).pathname.endsWith("/Point/RankingEventHistory");
        } catch {
          return false;
        }
      },
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: cr([]),
        })
    );

    await page.goto("/dashboard/operacao/rankings/eventos");

    await expect(page.getByTestId("event-card")).toContainText(
      "Premiação Janeiro TLGD"
    );
    await expect(page.getByTestId("event-card")).toContainText("Mochila TLGD");

    // Abre modal de novo evento via quick action
    await page.getByRole("button", { name: /Novo evento/ }).first().click();
    await expect(page.getByTestId("evento-nome-input")).toBeVisible();
  });
});
