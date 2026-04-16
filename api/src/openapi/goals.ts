import type { OpenApiFragment } from "./base";

export const goalsOpenApi: OpenApiFragment = {
  paths: {
    "/goals": {
      get: {
        tags: ["Goals"],
        summary: "Lista metas",
        parameters: [
          { in: "query", name: "limit", schema: { type: "integer" } },
          { in: "query", name: "offset", schema: { type: "integer" } },
          { in: "query", name: "q", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Metas retornadas",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Goal" },
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
        tags: ["Goals"],
        summary: "Cria uma meta",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: ["string", "null"] },
                  type: { type: ["integer", "null"], enum: [1, 2, 3, 4, 5, null] },
                  imageUrl: { type: ["string", "null"] },
                },
                required: ["name"],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Meta criada",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    goal: { $ref: "#/components/schemas/Goal" },
                  },
                  required: ["message", "goal"],
                },
              },
            },
          },
        },
      },
    },
    "/goals/{id}": {
      get: {
        tags: ["Goals"],
        summary: "Detalha uma meta",
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Meta retornada",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    goal: { $ref: "#/components/schemas/Goal" },
                    rewards: {
                      type: "array",
                      items: { $ref: "#/components/schemas/GoalReward" },
                    },
                  },
                  required: ["goal", "rewards"],
                },
              },
            },
          },
        },
      },
      put: {
        tags: ["Goals"],
        summary: "Atualiza uma meta",
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: ["string", "null"] },
                  type: { type: ["integer", "null"], enum: [1, 2, 3, 4, 5, null] },
                  imageUrl: { type: ["string", "null"] },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Meta atualizada",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    goal: { $ref: "#/components/schemas/Goal" },
                  },
                  required: ["message", "goal"],
                },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Goals"],
        summary: "Exclui uma meta",
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Meta excluida",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" },
              },
            },
          },
        },
      },
    },
    "/goals/rewards": {
      get: {
        tags: ["Goals"],
        summary: "Lista recompensas de metas",
        parameters: [
          { in: "query", name: "goalId", schema: { type: "integer" } },
          { in: "query", name: "courseId", schema: { type: "integer" } },
          { in: "query", name: "limit", schema: { type: "integer" } },
          { in: "query", name: "offset", schema: { type: "integer" } },
        ],
        responses: {
          "200": {
            description: "Recompensas retornadas",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: { $ref: "#/components/schemas/GoalReward" },
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
        tags: ["Goals"],
        summary: "Cria uma recompensa de meta",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  goalId: { type: "integer" },
                  badgeId: { type: "integer" },
                  courseId: { type: "integer" },
                  rewardType: { type: "integer" },
                  pointsTarget: { type: ["number", "null"] },
                  startDateTarget: { type: ["string", "null"], format: "date-time" },
                  endDateTarget: { type: ["string", "null"], format: "date-time" },
                  points: { type: ["number", "null"] },
                },
                required: ["goalId", "badgeId", "courseId"],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Recompensa criada",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    reward: { $ref: "#/components/schemas/GoalReward" },
                  },
                  required: ["message", "reward"],
                },
              },
            },
          },
        },
      },
    },
    "/goals/rewards/{id}": {
      put: {
        tags: ["Goals"],
        summary: "Atualiza uma recompensa de meta",
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Recompensa atualizada",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    reward: { $ref: "#/components/schemas/GoalReward" },
                  },
                  required: ["message", "reward"],
                },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Goals"],
        summary: "Exclui uma recompensa de meta",
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Recompensa excluida",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MessageResponse" },
              },
            },
          },
        },
      },
    },
    "/goals/students": {
      get: {
        tags: ["Goals"],
        summary: "Lista progresso dos alunos nas metas",
        parameters: [
          { in: "query", name: "courseId", schema: { type: "integer" } },
          { in: "query", name: "goalRewardId", schema: { type: "integer" } },
          { in: "query", name: "limit", schema: { type: "integer" } },
          { in: "query", name: "offset", schema: { type: "integer" } },
        ],
        responses: {
          "200": {
            description: "Progressos retornados",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: { $ref: "#/components/schemas/GoalStudent" },
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
        tags: ["Goals"],
        summary: "Atribui uma meta a um aluno",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  userId: { type: "integer" },
                  goalRewardId: { type: "integer" },
                  courseId: { type: "integer" },
                },
                required: ["userId", "goalRewardId", "courseId"],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Aluno atribuido",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    goalStudent: { $ref: "#/components/schemas/GoalStudent" },
                  },
                  required: ["message", "goalStudent"],
                },
              },
            },
          },
        },
      },
    },
    "/goals/students/{id}": {
      put: {
        tags: ["Goals"],
        summary: "Atualiza progresso de um aluno na meta",
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  progress: { type: "number" },
                  isCompleted: { type: "boolean" },
                  goalRewardId: { type: "integer" },
                  courseId: { type: "integer" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Progresso atualizado",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    goalStudent: { $ref: "#/components/schemas/GoalStudent" },
                  },
                  required: ["message", "goalStudent"],
                },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Goals"],
        summary: "Remove a atribuicao de uma meta a um aluno",
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
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
    "/goals/students/{id}/claim": {
      post: {
        tags: ["Goals"],
        summary: "Resgata a recompensa de uma meta concluida",
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Recompensa resgatada",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    goalStudent: { $ref: "#/components/schemas/GoalStudent" },
                  },
                  required: ["message", "goalStudent"],
                },
              },
            },
          },
        },
      },
    },
  },
};
