import type { OpenApiFragment } from "./base";

export const usersOpenApi: OpenApiFragment = {
  paths: {
    "/users/me": {
      get: {
        tags: ["Users"],
        summary: "Retorna o usuario autenticado",
        description:
          "Aceita JWT de sessão ou API token. Com API token, o endpoint valida o escopo usuarios:read.",
        security: [{ bearerAuth: [] }, { apiTokenAuth: [] }],
        responses: {
          "200": {
            description: "Perfil atual",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserSummary" },
              },
            },
          },
          "401": {
            description: "Token ausente ou invalido",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      put: {
        tags: ["Users"],
        summary: "Atualiza perfil do usuario autenticado",
        description:
          "Aceita JWT de sessão ou API token. Com API token, o endpoint valida o escopo usuarios:write.",
        security: [{ bearerAuth: [] }, { apiTokenAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  nome: { type: "string" },
                  bio: { type: "string" },
                  profilePictureUrl: { type: "string" },
                  coverPictureUrl: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Perfil atualizado",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    user: { $ref: "#/components/schemas/UserSummary" },
                  },
                  required: ["message", "user"],
                },
              },
            },
          },
        },
      },
    },
    "/users": {
      get: {
        tags: ["Users"],
        summary: "Lista usuarios",
        description:
          "Aceita JWT de sessão ou API token. Com API token, a leitura exige usuarios:read.",
        security: [{ bearerAuth: [] }, { apiTokenAuth: [] }],
        parameters: [
          {
            in: "query",
            name: "role",
            schema: {
              type: "string",
              enum: ["aluno", "professor", "admin"],
            },
          },
          {
            in: "query",
            name: "q",
            schema: { type: "string" },
          },
          {
            in: "query",
            name: "page",
            schema: { type: "integer" },
          },
          {
            in: "query",
            name: "limit",
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": {
            description: "Lista simples ou paginada",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    {
                      type: "array",
                      items: { $ref: "#/components/schemas/UserSummary" },
                    },
                    {
                      type: "object",
                      properties: {
                        items: {
                          type: "array",
                          items: { $ref: "#/components/schemas/UserSummary" },
                        },
                        total: { type: "integer" },
                        pagination: { $ref: "#/components/schemas/Pagination" },
                      },
                      required: ["items", "total", "pagination"],
                    },
                  ],
                },
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
      post: {
        tags: ["Users"],
        summary: "Cria um usuario",
        description:
          "Aceita JWT de sessão ou API token. Com API token, a escrita exige usuarios:write.",
        security: [{ bearerAuth: [] }, { apiTokenAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  usuario: { type: "string" },
                  email: { type: "string" },
                  nome: { type: "string" },
                  senha: { type: "string" },
                  role: {
                    type: "string",
                    enum: ["admin", "professor", "aluno"],
                  },
                  adminPassword: { type: "string" },
                },
                required: ["usuario", "nome", "senha"],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Usuario criado",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    user: { $ref: "#/components/schemas/UserSummary" },
                  },
                  required: ["message", "user"],
                },
              },
            },
          },
        },
      },
    },
    "/users/me/password": {
      put: {
        tags: ["Users"],
        summary: "Altera a senha do usuario autenticado",
        description:
          "Aceita JWT de sessão ou API token. Com API token, o request precisa de usuarios:write.",
        security: [{ bearerAuth: [] }, { apiTokenAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  senhaAtual: { type: "string" },
                  novaSenha: { type: "string" },
                },
                required: ["senhaAtual", "novaSenha"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Senha alterada",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" },
              },
            },
          },
        },
      },
    },
    "/users/me/profile-picture": {
      post: {
        tags: ["Users"],
        summary: "Atualiza a foto de perfil do usuario autenticado",
        description:
          "Aceita JWT de sessão ou API token. Com API token, o request precisa de usuarios:write.",
        security: [{ bearerAuth: [] }, { apiTokenAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  file: {
                    type: "string",
                    format: "binary",
                  },
                },
                required: ["file"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Foto atualizada",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    profilePictureUrl: { type: "string" },
                    user: { $ref: "#/components/schemas/UserSummary" },
                  },
                  required: ["message", "profilePictureUrl", "user"],
                },
              },
            },
          },
        },
      },
    },
    "/users/me/cover-picture": {
      post: {
        tags: ["Users"],
        summary: "Atualiza o banner do usuario autenticado",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  file: {
                    type: "string",
                    format: "binary",
                  },
                },
                required: ["file"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Banner atualizado",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    coverPictureUrl: { type: "string" },
                    user: { $ref: "#/components/schemas/UserSummary" },
                  },
                  required: ["message", "coverPictureUrl", "user"],
                },
              },
            },
          },
        },
      },
    },
    "/users/{id}": {
      put: {
        tags: ["Users"],
        summary: "Atualiza um usuario por id",
        parameters: [
          {
            in: "path",
            name: "id",
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
                  nome: { type: "string" },
                  usuario: { type: "string" },
                  email: { type: "string" },
                  role: {
                    type: "string",
                    enum: ["admin", "professor", "aluno"],
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Usuario atualizado",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    user: { $ref: "#/components/schemas/UserSummary" },
                  },
                  required: ["message", "user"],
                },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Users"],
        summary: "Remove um usuario por id",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Usuario deletado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" },
              },
            },
          },
        },
      },
    },
  },
};
