import type { OpenApiFragment } from "./base";

export const badgesOpenApi: OpenApiFragment = {
  paths: {
    "/badges": {
      get: {
        tags: ["Badges"],
        summary: "Lista medalhas",
        parameters: [
          { in: "query", name: "limit", schema: { type: "integer" } },
          { in: "query", name: "offset", schema: { type: "integer" } },
          { in: "query", name: "q", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Medalhas retornadas",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Badge" },
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
        tags: ["Badges"],
        summary: "Cria uma medalha",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  iconUrl: { type: "string" },
                },
                required: ["name", "description", "iconUrl"],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Medalha criada",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    badge: { $ref: "#/components/schemas/Badge" },
                  },
                  required: ["message", "badge"],
                },
              },
            },
          },
        },
      },
    },
    "/badges/{id}": {
      put: {
        tags: ["Badges"],
        summary: "Atualiza uma medalha",
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  iconUrl: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Medalha atualizada",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    badge: { $ref: "#/components/schemas/Badge" },
                  },
                  required: ["message", "badge"],
                },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Badges"],
        summary: "Exclui uma medalha",
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Medalha excluida",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" },
              },
            },
          },
        },
      },
    },
    "/badges/holders": {
      get: {
        tags: ["Badges"],
        summary: "Lista atribuicoes de medalhas",
        parameters: [
          { in: "query", name: "badgeId", schema: { type: "integer" } },
          { in: "query", name: "limit", schema: { type: "integer" } },
          { in: "query", name: "offset", schema: { type: "integer" } },
        ],
        responses: {
          "200": {
            description: "Atribuicoes retornadas",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: { $ref: "#/components/schemas/BadgeHolder" },
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
        tags: ["Badges"],
        summary: "Atribui uma medalha a um usuario",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  userId: { type: "integer" },
                  badgeId: { type: "integer" },
                },
                required: ["userId", "badgeId"],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Medalha atribuida",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    holder: { $ref: "#/components/schemas/BadgeHolder" },
                  },
                  required: ["message", "holder"],
                },
              },
            },
          },
        },
      },
    },
    "/badges/holders/{id}": {
      put: {
        tags: ["Badges"],
        summary: "Troca a medalha de uma atribuicao",
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  badgeId: { type: "integer" },
                },
                required: ["badgeId"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Atribuicao atualizada",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    holder: { $ref: "#/components/schemas/BadgeHolder" },
                  },
                  required: ["message", "holder"],
                },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Badges"],
        summary: "Remove uma medalha de um usuario",
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Atribuicao removida",
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
