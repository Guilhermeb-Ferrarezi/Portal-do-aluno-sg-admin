import type { OpenApiFragment } from "./base";

export const activityLogsOpenApi: OpenApiFragment = {
  paths: {
    "/activity-logs": {
      get: {
        tags: ["Activity Logs"],
        summary: "Lista logs de atividade administrativa",
        parameters: [
          { in: "query", name: "limit", schema: { type: "integer" } },
          { in: "query", name: "offset", schema: { type: "integer" } },
          { in: "query", name: "action", schema: { type: "string" } },
          { in: "query", name: "entityType", schema: { type: "string" } },
          { in: "query", name: "actorId", schema: { type: "string" } },
          { in: "query", name: "q", schema: { type: "string" } },
          { in: "query", name: "from", schema: { type: "string", format: "date-time" } },
          { in: "query", name: "to", schema: { type: "string", format: "date-time" } },
          {
            in: "query",
            name: "actorGroup",
            schema: { type: "string", enum: ["user", "staff"] },
          },
        ],
        responses: {
          "200": {
            description: "Logs retornados",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ActivityLog" },
                    },
                    total: { type: "integer" },
                  },
                  required: ["items", "total"],
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
    },
  },
};
