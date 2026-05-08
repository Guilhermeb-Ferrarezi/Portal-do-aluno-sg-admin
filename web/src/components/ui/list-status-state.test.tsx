import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ListStatusState } from "./list-status-state";

describe("ListStatusState", () => {
  it("renderiza loading customizado quando recebe titulo e descricao", () => {
    render(
      <ListStatusState
        mode="loading"
        loadingTitle="Carregando usuarios..."
        loadingDescription="Buscando a lista paginada."
      />
    );

    expect(screen.getByText("Carregando usuarios...")).toBeInTheDocument();
    expect(screen.getByText("Buscando a lista paginada.")).toBeInTheDocument();
  });

  it("renderiza estado de erro com retry", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <ListStatusState
        mode="error"
        title="Nao foi possivel carregar."
        description="Falha de rede."
        onRetry={onRetry}
      />
    );

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(screen.getByText("Nao foi possivel carregar.")).toBeInTheDocument();
    expect(screen.getByText("Falha de rede.")).toBeInTheDocument();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
