import type { OpenApiFragment } from "./base";

export const apiTokensOpenApi: OpenApiFragment = {
  tags: [
    {
      name: "API Tokens",
      description:
        "Gerencie tokens opacos usados por integrações externas. O segredo é exibido apenas no momento da criação.",
    },
  ],
  paths: {
    "/tokens/scopes": {
      get: {
        tags: ["API Tokens"],
        summary: "Lista o catalogo de escopos disponiveis",
        description:
          "Retorna a taxonomia oficial de permissões para API tokens. Cada item mostra a chave interna, o rótulo humano e a descrição de uso.",
        security: [{ bearerAuth: [] }, { apiTokenAuth: [] }],
        responses: {
          "200": {
            description: "Catalogo de escopos retornado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiTokenScopeCatalog" },
              },
            },
          },
        },
      },
    },
    "/tokens": {
      get: {
        tags: ["API Tokens"],
        summary: "Lista os tokens da conta autenticada",
        description:
          "Aceita JWT de sessão ou API token. Quando o request usa API token, a leitura exige escopo compatível com o recurso do endpoint consumido.",
        security: [{ bearerAuth: [] }, { apiTokenAuth: [] }],
        responses: {
          "200": {
            description: "Tokens retornados",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ApiToken" },
                    },
                    total: { type: "integer" },
                  },
                  required: ["items", "total"],
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["API Tokens"],
        summary: "Cria um novo token de integracao",
        description:
          "Gera um segredo opaco somente uma vez. O valor em claro não volta em listagens ou atualizações, apenas o hash persistido no banco.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiTokenCreateRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Token criado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiTokenCreateResponse" },
              },
            },
          },
        },
      },
    },
    "/tokens/{publicId}": {
      patch: {
        tags: ["API Tokens"],
        summary: "Atualiza nome, descricao, escopos ou expiração",
        description:
          "Só o dono do token pode alterar o registro. Se o escopo enviado for de edição, o escopo de leitura correspondente também é persistido automaticamente.",
        security: [{ bearerAuth: [] }],
        parameters: [{ in: "path", name: "publicId", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiTokenCreateRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Token atualizado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiToken" },
              },
            },
          },
        },
      },
      delete: {
        tags: ["API Tokens"],
        summary: "Revoga um token",
        description:
          "A revogação invalida imediatamente qualquer integração que esteja usando o segredo do token.",
        security: [{ bearerAuth: [] }],
        parameters: [{ in: "path", name: "publicId", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Token revogado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" },
              },
            },
          },
        },
      },
    },
    "/tokens/self": {
      get: {
        tags: ["API Tokens"],
        summary: "Valida o token atual e expõe a identidade associada",
        description:
          "Este endpoint é útil para testar integrações e confirmar quais escopos estão ativos no token em uso.",
        security: [{ bearerAuth: [] }, { apiTokenAuth: [] }],
        responses: {
          "200": {
            description: "Token autenticado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserSummary" },
              },
            },
          },
        },
      },
    },
  },
};
