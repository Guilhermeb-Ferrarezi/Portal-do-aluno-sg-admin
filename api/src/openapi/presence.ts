import type { OpenApiFragment } from "./base";

export const presenceOpenApi: OpenApiFragment = {
  paths: {
    "/presence/socket-ticket": {
      post: {
        tags: ["Presence"],
        summary: "Emite ticket temporario para conexao WebSocket de presenca",
        description:
          "Aceita autenticacao via bearer token do usuario ou via cabecalho x-presence-proxy-secret para chamadas de proxy confiavel.",
        parameters: [
          {
            in: "header",
            name: "x-presence-proxy-secret",
            required: false,
            schema: { type: "string" },
          },
          {
            in: "header",
            name: "x-presence-client-ip",
            required: false,
            schema: { type: "string" },
          },
          {
            in: "header",
            name: "x-presence-client-user-agent",
            required: false,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  userId: { type: "string" },
                  sub: { type: "string" },
                  usuario: { type: "string" },
                  email: { type: "string" },
                  roleId: { oneOf: [{ type: "integer" }, { type: "string" }] },
                  role: { type: "string", enum: ["aluno", "professor", "admin"] },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Ticket emitido com sucesso",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    token: { type: "string" },
                    expiresAt: { type: "string", format: "date-time" },
                  },
                  required: ["ok", "token", "expiresAt"],
                },
              },
            },
          },
          "401": {
            description: "Token ausente, invalido ou proxy nao autorizado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/presence/heartbeat": {
      post: {
        tags: ["Presence"],
        summary: "Atualiza o heartbeat HTTP de presenca do usuario",
        description:
          "Aceita autenticacao via bearer token do usuario ou via cabecalho x-presence-proxy-secret para chamadas de proxy confiavel.",
        parameters: [
          {
            in: "header",
            name: "x-presence-proxy-secret",
            required: false,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  userId: { type: "string" },
                  sub: { type: "string" },
                  usuario: { type: "string" },
                  email: { type: "string" },
                  roleId: { oneOf: [{ type: "integer" }, { type: "string" }] },
                  role: { type: "string", enum: ["aluno", "professor", "admin"] },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Presenca atualizada",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    lastSeenAt: { type: ["string", "null"], format: "date-time" },
                  },
                  required: ["ok", "lastSeenAt"],
                },
              },
            },
          },
          "401": {
            description: "Token ausente, invalido ou proxy nao autorizado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "500": {
            description: "Falha ao atualizar a presenca",
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
