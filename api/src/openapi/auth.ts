import type { OpenApiFragment } from "./base";

export const authOpenApi: OpenApiFragment = {
  paths: {
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Realiza login com usuario e senha",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Login realizado com sucesso",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginResponse" },
              },
            },
          },
          "400": {
            description: "Dados invalidos",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "401": {
            description: "Credenciais invalidas",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Renova o access token usando refresh token",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RefreshRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Token renovado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RefreshResponse" },
              },
            },
          },
          "400": {
            description: "Refresh token invalido",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "401": {
            description: "Refresh token expirado ou revogado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Finaliza a sessao atual",
        security: [],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RefreshRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Logout finalizado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" },
              },
            },
          },
        },
      },
    },
    "/auth/sso": {
      get: {
        tags: ["Auth"],
        summary: "Troca um codigo SSO por sessao local",
        security: [],
        parameters: [
          {
            in: "query",
            name: "code",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Login SSO realizado com sucesso",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginResponse" },
              },
            },
          },
          "400": {
            description: "Codigo SSO ausente ou invalido",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "403": {
            description: "Usuario nao permitido no portal",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/auth/student-view/start": {
      post: {
        tags: ["Auth"],
        summary: "Inicia SSO para abrir a visao do aluno",
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  returnTo: {
                    type: "string",
                    format: "uri",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Fluxo SSO iniciado",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    redirectUrl: { type: "string", format: "uri" },
                    expiresAt: { type: "string", format: "date-time" },
                  },
                  required: ["redirectUrl", "expiresAt"],
                },
              },
            },
          },
          "401": {
            description: "Sessao invalida",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "403": {
            description: "Sem permissao",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/auth/student-view/exchange": {
      post: {
        tags: ["Auth"],
        summary: "Consome o codigo SSO da visao do aluno",
        security: [],
        parameters: [
          {
            in: "header",
            name: "x-sso-shared-secret",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  code: { type: "string" },
                },
                required: ["code"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Codigo validado",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        email: { type: "string" },
                        name: { type: "string" },
                      },
                      required: ["id", "email", "name"],
                    },
                    returnTo: { type: ["string", "null"], format: "uri" },
                  },
                  required: ["user", "returnTo"],
                },
              },
            },
          },
          "401": {
            description: "Codigo invalido ou expirado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "403": {
            description: "Shared secret invalido",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
  },
};
