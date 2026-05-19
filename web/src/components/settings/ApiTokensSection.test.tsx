import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/api", async () => {
  const actual = await vi.importActual<typeof import("@/services/api")>("@/services/api");
  return {
    ...actual,
    listarApiTokens: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    listarApiTokenScopes: vi.fn().mockResolvedValue({
      items: [
        {
          key: "operacoes",
          label: "Operacoes",
          description: "Acesso a tarefas operacionais do portal.",
          items: [
            {
              value: "turmas:read",
              label: "Ler turmas",
              description: "Visualizar turmas e seus detalhes.",
            },
            {
              value: "turmas:write",
              label: "Editar turmas",
              description: "Criar e alterar turmas.",
            },
          ],
        },
      ],
    }),
    criarApiToken: vi.fn().mockResolvedValue({
      token: {
        publicId: "token-123",
        name: "Integração ERP",
        description: null,
        scopes: ["turmas:read"],
        expiresAt: null,
        revokedAt: null,
        lastUsedAt: null,
        createdAt: "2026-05-19T15:00:00.000Z",
        status: "active",
      },
      secret: "pat_token-123.secret-value",
      secretHint: "alue",
      scopes: ["turmas:read"],
      scopesDetail: { values: ["turmas:read"], labels: ["Ler turmas"] },
    }),
    atualizarApiToken: vi.fn(),
    revogarApiToken: vi.fn(),
  };
});

import ApiTokensSection from "./ApiTokensSection";

describe("ApiTokensSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mostra o estado vazio inicial", async () => {
    render(<ApiTokensSection />);

    expect(await screen.findByText("Nenhum token criado ainda")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar primeiro token" })).toBeInTheDocument();
  });

  it("cria um token e mostra o segredo apenas no fluxo de criacao", async () => {
    const user = userEvent.setup();

    render(<ApiTokensSection />);

    await user.click(await screen.findByRole("button", { name: "Criar primeiro token" }));
    await user.type(screen.getByLabelText("Nome do token"), "Integração ERP");
    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: "Criar token" }));

    await waitFor(() => expect(screen.getByText("Token criado")).toBeInTheDocument());
    expect(screen.getByText("pat_token-123.secret-value")).toBeInTheDocument();
  });
});
