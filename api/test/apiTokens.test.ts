import { describe, expect, it } from "bun:test";
import {
  buildApiTokenValue,
  expandApiTokenScopes,
  normalizeApiTokenScopes,
  parseApiTokenValue,
  tokenScopesCatalog,
} from "../src/services/apiTokens";

describe("api token helpers", () => {
  it("gera um token opaco que pode ser parseado e hashado", () => {
    const issued = buildApiTokenValue("11111111-2222-3333-4444-555555555555");

    expect(issued.token).toStartWith("pat_11111111-2222-3333-4444-555555555555.");
    expect(issued.secret).toBeTruthy();
    expect(issued.secretHash).toHaveLength(64);

    const parsed = parseApiTokenValue(issued.token);

    expect(parsed).toEqual({
      publicId: "11111111-2222-3333-4444-555555555555",
      secret: issued.secret,
    });
  });

  it("deduplica e rejeita escopos desconhecidos", () => {
    expect(
      normalizeApiTokenScopes([
        "turmas:read",
        "turmas:read",
        "usuarios:write",
      ])
    ).toEqual(["turmas:read", "usuarios:write"]);

    expect(() => normalizeApiTokenScopes(["not-a-scope"])).toThrow(
      "Escopo de API token invalido"
    );
  });

  it("expõe um catalogo agrupado de escopos", () => {
    expect(tokenScopesCatalog.map((group) => group.key)).toEqual([
      "operacoes",
      "conteudo",
      "administracao",
    ]);
    expect(tokenScopesCatalog[0].items.some((item) => item.value === "turmas:read")).toBe(true);
    expect(
      tokenScopesCatalog[2].items.some((item) => item.value === "logs:read")
    ).toBe(true);
    expect(tokenScopesCatalog[2].items.some((item) => item.value === "logs:write")).toBe(false);
  });

  it("expande permissao de edicao para leitura correspondente", () => {
    expect(expandApiTokenScopes(["turmas:write", "logs:read"])).toEqual([
      "turmas:write",
      "turmas:read",
      "logs:read",
    ]);
  });
});
