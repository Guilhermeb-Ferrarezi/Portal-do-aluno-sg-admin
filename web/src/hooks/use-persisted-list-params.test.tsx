import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { usePersistedListParams } from "./use-persisted-list-params";

function HookProbe() {
  const location = useLocation();
  const { values, setParams } = usePersistedListParams(
    {
      q: { defaultValue: "" as string },
      page: {
        defaultValue: 1,
        parse: (value) => {
          const parsed = Number(value);
          return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
        },
      },
      limit: {
        defaultValue: 5,
        parse: (value) => {
          const parsed = Number(value);
          return [5, 10, 20, 50].includes(parsed) ? parsed : 5;
        },
      },
    },
    { pageKey: "page" }
  );

  return (
    <div>
      <output data-testid="search">{location.search}</output>
      <output data-testid="values">{JSON.stringify(values)}</output>
      <button type="button" onClick={() => setParams({ q: "ana" })}>
        change-filter
      </button>
      <button type="button" onClick={() => setParams({ page: 3 }, { resetPage: false })}>
        change-page
      </button>
      <button type="button" onClick={() => setParams({ q: "" })}>
        clear-filter
      </button>
    </div>
  );
}

function renderProbe(initialEntry = "/") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <HookProbe />
    </MemoryRouter>
  );
}

function StabilityProbe() {
  const [renderTick, setRenderTick] = React.useState(0);
  const [effectRuns, setEffectRuns] = React.useState(0);
  const { setParams } = usePersistedListParams(
    {
      q: { defaultValue: "" as string },
      page: {
        defaultValue: 1,
        parse: (value) => {
          const parsed = Number(value);
          return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
        },
      },
    },
    { pageKey: "page" }
  );

  React.useEffect(() => {
    setEffectRuns((current) => current + 1);
  }, [setParams]);

  return (
    <div>
      <output data-testid="effect-runs">{effectRuns}</output>
      <output data-testid="render-tick">{renderTick}</output>
      <button type="button" onClick={() => setRenderTick((current) => current + 1)}>
        rerender
      </button>
    </div>
  );
}

function renderStabilityProbe(initialEntry = "/") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <StabilityProbe />
    </MemoryRouter>
  );
}

describe("usePersistedListParams", () => {
  it("reseta a pagina para o valor padrao ao alterar filtros", async () => {
    const user = userEvent.setup();
    renderProbe("/?page=3&limit=10");

    await user.click(screen.getByRole("button", { name: "change-filter" }));

    expect(screen.getByTestId("search")).toHaveTextContent("?limit=10&q=ana");
    expect(screen.getByTestId("values")).toHaveTextContent(
      JSON.stringify({ q: "ana", page: 1, limit: 10 })
    );
  });

  it("remove parametros ao voltar para o valor padrao", async () => {
    const user = userEvent.setup();
    renderProbe("/?q=ana");

    await user.click(screen.getByRole("button", { name: "clear-filter" }));

    expect(screen.getByTestId("search")).toHaveTextContent("");
    expect(screen.getByTestId("values")).toHaveTextContent(
      JSON.stringify({ q: "", page: 1, limit: 5 })
    );
  });

  it("mantem a pagina quando a atualizacao pede para nao resetar", async () => {
    const user = userEvent.setup();
    renderProbe("/?page=1");

    await user.click(screen.getByRole("button", { name: "change-page" }));

    expect(screen.getByTestId("search")).toHaveTextContent("?page=3");
    expect(screen.getByTestId("values")).toHaveTextContent(
      JSON.stringify({ q: "", page: 3, limit: 5 })
    );
  });

  it("mantem setParams estavel em rerenders sem mudar a query", async () => {
    const user = userEvent.setup();
    renderStabilityProbe();

    expect(screen.getByTestId("effect-runs")).toHaveTextContent("1");

    await user.click(screen.getByRole("button", { name: "rerender" }));

    expect(screen.getByTestId("render-tick")).toHaveTextContent("1");
    expect(screen.getByTestId("effect-runs")).toHaveTextContent("1");
  });
});
