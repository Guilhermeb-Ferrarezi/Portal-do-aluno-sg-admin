import { expect, test } from "@playwright/test";

type MockUser = {
  id: string;
  nome: string;
  email: string;
  role: "aluno" | "professor" | "admin";
  isOnline: boolean;
  lastSeenAt: string | null;
};

const mockUsers: MockUser[] = [
  {
    id: "user-1",
    nome: "Aluno",
    email: "aluno@gmail.com",
    role: "aluno",
    isOnline: false,
    lastSeenAt: null,
  },
  {
    id: "user-2",
    nome: "Guilherme aluno",
    email: "guilhermesgschool@gmail.com",
    role: "aluno",
    isOnline: false,
    lastSeenAt: "2026-04-16T12:00:00.000Z",
  },
  {
    id: "user-3",
    nome: "willian",
    email: "willianchiquinato2@hotmail.com",
    role: "admin",
    isOnline: false,
    lastSeenAt: "2026-04-16T10:00:00.000Z",
  },
];

function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fakesig`;
}

test.describe("admin users checkboxes", () => {
  test.beforeEach(async ({ page }) => {
    const fakeToken = makeFakeJwt({ sub: "admin-1", usuario: "admin", role: 3 });

    await page.addInitScript(
      ({ token, refreshToken, nome }: { token: string; refreshToken: string; nome: string }) => {
        localStorage.setItem("token", token);
        localStorage.setItem("refreshToken", refreshToken);
        localStorage.setItem("nome", nome);

        class MockWebSocket {
          static readonly CONNECTING = 0;
          static readonly OPEN = 1;
          static readonly CLOSING = 2;
          static readonly CLOSED = 3;

          readonly url: string;
          readonly protocol = "portal-aluno-presence.v1";
          readyState = MockWebSocket.OPEN;

          constructor(url: string) {
            this.url = url;
          }

          addEventListener() {}
          removeEventListener() {}
          send() {}
          close() {
            this.readyState = MockWebSocket.CLOSED;
          }
        }

        Object.defineProperty(window, "WebSocket", {
          configurable: true,
          writable: true,
          value: MockWebSocket,
        });
      },
      { token: fakeToken, refreshToken: "fake-refresh-token", nome: "Admin Teste" }
    );

    await page.route(
      (url) => {
        try {
          return new URL(url).pathname.startsWith("/api/");
        } catch {
          return false;
        }
      },
      async (route) => {
        const url = new URL(route.request().url());
        const { pathname, searchParams } = url;
        const method = route.request().method();

        if (pathname === "/api/users/me" && method === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              id: "admin-1",
              nome: "Admin Teste",
              email: "admin@test.local",
              usuario: "admin",
              role: "admin",
              ativo: true,
              createdAt: "2026-04-16T12:00:00.000Z",
            }),
          });
          return;
        }

        if (pathname === "/api/presence/socket-ticket" && method === "POST") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ok: true,
              ticket: "fake-ticket",
              expiresAt: "2026-04-16T13:00:00.000Z",
            }),
          });
          return;
        }

        if (pathname === "/api/users" && method === "GET") {
          const pageParam = Number(searchParams.get("page") ?? "1");
          const limitParam = Number(searchParams.get("limit") ?? "5");

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              items: mockUsers,
              total: mockUsers.length,
              pagination: {
                page: pageParam,
                limit: limitParam,
                total: mockUsers.length,
                totalPages: 1,
              },
            }),
          });
          return;
        }

        if (method === "GET") {
          await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      }
    );
  });

  test("toggles row and header checkboxes", async ({ page }) => {
    await page.goto("/dashboard/usuarios/usuarios");

    await expect(page.getByText("Clique com o botao direito em um usuario para ver as opcoes.")).toBeVisible();

    const selectAll = page.getByLabel("Selecionar usuarios visiveis");
    const firstRow = page.getByLabel("Selecionar Aluno");
    const secondRow = page.getByLabel("Selecionar Guilherme aluno");

    await expect(selectAll).not.toBeChecked();
    await expect(firstRow).not.toBeChecked();
    await expect(secondRow).not.toBeChecked();

    await firstRow.click();
    await expect(firstRow).toBeChecked();
    await expect(page.getByText("1 usuario(s) selecionado(s)")).toBeVisible();
    await expect(selectAll).not.toBeChecked();

    await selectAll.click();
    await expect(selectAll).toBeChecked();
    await expect(firstRow).toBeChecked();
    await expect(secondRow).toBeChecked();
    await expect(page.getByText("3 usuario(s) selecionado(s)")).toBeVisible();

    await selectAll.click();
    await expect(selectAll).not.toBeChecked();
    await expect(firstRow).not.toBeChecked();
    await expect(secondRow).not.toBeChecked();
  });
});
