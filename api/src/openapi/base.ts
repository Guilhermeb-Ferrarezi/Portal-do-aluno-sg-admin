export type OpenApiFragment = {
  tags?: Array<Record<string, unknown>>;
  paths?: Record<string, unknown>;
  components?: Record<string, unknown>;
};

export const baseOpenApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Portal do Aluno API",
    version: "1.0.0",
    description:
      "Documentacao operacional da API do Portal do Aluno. O servidor suporta uso com e sem prefixo /api. " +
      "A API aceita JWT de sessao e API tokens opacos gerados pelo usuario.",
  },
  servers: [
    {
      url: "/api",
      description: "Acesso via proxy do admin portal",
    },
    {
      url: "/",
      description: "Acesso direto sem prefixo",
    },
  ],
  security: [{ bearerAuth: [] }],
  tags: [
    { name: "Auth", description: "Autenticacao, refresh e SSO" },
    { name: "Users", description: "Perfil e gerenciamento de usuarios" },
    { name: "API Tokens", description: "Geracao, listagem e revogacao de tokens de integracao" },
    { name: "Activity Logs", description: "Auditoria administrativa" },
    { name: "Badges", description: "Medalhas e atribuicoes" },
    { name: "Goals", description: "Metas, recompensas e progresso dos alunos" },
    { name: "Turmas", description: "Cursos, turmas, modulos, fases e salas" },
    { name: "Materials", description: "Materiais de estudo e vinculos" },
    { name: "Videoaulas", description: "Videoaulas e modulos" },
    { name: "Notifications", description: "Templates, disparos e notificacoes" },
    { name: "Presence", description: "Presenca em tempo real e heartbeat HTTP" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT de sessao do portal.",
      },
      apiTokenAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "opaque token",
        description:
          "API token opaco emitido por /api/tokens. Use em integrações e automações.",
      },
    },
    schemas: {
      ApiTokenScopeCatalogGroup: {
        type: "object",
        properties: {
          key: { type: "string" },
          label: { type: "string" },
          description: { type: "string" },
          permissions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                value: { type: "string" },
                label: { type: "string" },
                description: { type: "string" },
                access: { type: "string", enum: ["read", "write"] },
              },
              required: ["value", "label", "description", "access"],
            },
          },
        },
        required: ["key", "label", "description", "permissions"],
      },
      ApiTokenScopeCatalog: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/ApiTokenScopeCatalogGroup" },
          },
        },
        required: ["items"],
      },
      ApiTokenScopeDetail: {
        type: "object",
        properties: {
          values: {
            type: "array",
            items: { type: "string" },
          },
          labels: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["values", "labels"],
      },
      ApiToken: {
        type: "object",
        properties: {
          publicId: { type: "string" },
          userId: { type: "integer" },
          name: { type: "string" },
          description: { type: ["string", "null"] },
          scopes: {
            type: "array",
            items: { type: "string" },
          },
          scopesDetail: { $ref: "#/components/schemas/ApiTokenScopeDetail" },
          expiresAt: { type: ["string", "null"], format: "date-time" },
          revokedAt: { type: ["string", "null"], format: "date-time" },
          lastUsedAt: { type: ["string", "null"], format: "date-time" },
          createdAt: { type: "string", format: "date-time" },
        },
        required: ["publicId", "userId", "name", "scopes", "scopesDetail", "createdAt"],
      },
      ApiTokenCreateRequest: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: ["string", "null"] },
          scopes: {
            type: "array",
            items: { type: "string" },
          },
          expiresAt: { type: ["string", "null"], format: "date-time" },
        },
        required: ["name", "scopes"],
      },
      ApiTokenCreateResponse: {
        type: "object",
        properties: {
          token: { $ref: "#/components/schemas/ApiToken" },
          secret: { type: "string", description: "Mostrado apenas uma vez no create." },
          secretHint: { type: "string" },
          scopes: {
            type: "array",
            items: { type: "string" },
          },
          scopesDetail: { $ref: "#/components/schemas/ApiTokenScopeDetail" },
        },
        required: ["token", "secret", "secretHint", "scopes", "scopesDetail"],
      },
      ErrorResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          issues: {
            type: "object",
            additionalProperties: true,
          },
        },
        required: ["message"],
      },
      UserSummary: {
        type: "object",
        properties: {
          id: { type: "string" },
          usuario: { type: "string" },
          email: { type: "string" },
          nome: { type: "string" },
          bio: { type: ["string", "null"] },
          profilePictureUrl: { type: ["string", "null"] },
          coverPictureUrl: { type: ["string", "null"] },
          role: {
            type: "string",
            enum: ["aluno", "professor", "admin"],
          },
          ativo: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          lastSeenAt: { type: ["string", "null"], format: "date-time" },
          isOnline: { type: "boolean" },
        },
        required: ["id", "usuario", "email", "nome", "role", "ativo", "createdAt"],
      },
      Pagination: {
        type: "object",
        properties: {
          page: { type: "integer" },
          limit: { type: "integer" },
          total: { type: "integer" },
          totalPages: { type: "integer" },
        },
        required: ["page", "limit", "total", "totalPages"],
      },
      LoginRequest: {
        type: "object",
        properties: {
          usuario: { type: "string" },
          senha: { type: "string" },
        },
        required: ["usuario", "senha"],
      },
      RefreshRequest: {
        type: "object",
        properties: {
          refreshToken: { type: "string" },
        },
        required: ["refreshToken"],
      },
      LoginResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          token: { type: "string" },
          refreshToken: { type: "string" },
          user: { $ref: "#/components/schemas/UserSummary" },
        },
        required: ["message", "token", "refreshToken", "user"],
      },
      RefreshResponse: {
        type: "object",
        properties: {
          token: { type: "string" },
          refreshToken: { type: "string" },
        },
        required: ["token", "refreshToken"],
      },
      MessageResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
        },
        required: ["message"],
      },
      ActivityLog: {
        type: "object",
        properties: {
          id: { type: "string" },
          actorId: { type: ["string", "null"] },
          actorRole: {
            type: ["string", "null"],
            enum: ["aluno", "professor", "admin", null],
          },
          actorNome: { type: ["string", "null"] },
          actorUsuario: { type: ["string", "null"] },
          action: { type: "string" },
          entityType: { type: "string" },
          entityId: { type: ["string", "null"] },
          metadata: { type: ["object", "null"], additionalProperties: true },
          ipAddress: { type: ["string", "null"] },
          userAgent: { type: ["string", "null"] },
          createdAt: { type: "string", format: "date-time" },
        },
        required: ["id", "action", "entityType", "createdAt"],
      },
      Badge: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          iconUrl: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          holdersCount: { type: "integer" },
        },
        required: ["id", "name", "description", "iconUrl", "createdAt"],
      },
      BadgeHolder: {
        type: "object",
        properties: {
          holderId: { type: "string" },
          badgeId: { type: "string" },
          badgeName: { type: "string" },
          user: {
            type: "object",
            properties: {
              id: { type: "string" },
              nome: { type: "string" },
              email: { type: "string" },
            },
            required: ["id", "nome", "email"],
          },
          awardedAt: { type: "string", format: "date-time" },
        },
        required: ["holderId", "badgeId", "badgeName", "user", "awardedAt"],
      },
      Goal: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: ["string", "null"] },
          type: { type: ["integer", "null"], enum: [1, 2, 3, 4, 5, null] },
          imageUrl: { type: ["string", "null"] },
          rewardsCount: { type: "integer" },
        },
        required: ["id", "name", "rewardsCount"],
      },
      GoalReward: {
        type: "object",
        properties: {
          id: { type: "string" },
          goalId: { type: "string" },
          badgeId: { type: "string" },
          courseId: { type: "string" },
          points: { type: ["number", "null"] },
          createdAt: { type: "string", format: "date-time" },
          endDateTarget: { type: ["string", "null"], format: "date-time" },
          rewardType: { type: "integer" },
          startDateTarget: { type: ["string", "null"], format: "date-time" },
          pointsTarget: { type: ["number", "null"] },
          goalName: { type: "string" },
          badgeName: { type: "string" },
          badgeIconUrl: { type: ["string", "null"] },
          courseName: { type: "string" },
        },
        required: ["id", "goalId", "badgeId", "courseId", "createdAt", "rewardType", "goalName", "badgeName", "courseName"],
      },
      GoalStudent: {
        type: "object",
        properties: {
          id: { type: "string" },
          userId: { type: "string" },
          goalRewardId: { type: "string" },
          courseId: { type: "string" },
          progress: { type: "number" },
          isCompleted: { type: "boolean" },
          completedAt: { type: ["string", "null"], format: "date-time" },
          rewardClaimed: { type: "boolean" },
          rewardClaimedAt: { type: ["string", "null"], format: "date-time" },
          user: {
            type: "object",
            properties: {
              id: { type: "string" },
              nome: { type: "string" },
              email: { type: "string" },
            },
            required: ["id", "nome", "email"],
          },
          goal: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: ["string", "null"] },
              imageUrl: { type: ["string", "null"] },
              type: { type: ["integer", "null"], enum: [1, 2, 3, 4, 5, null] },
            },
            required: ["name"],
          },
          reward: {
            type: "object",
            properties: {
              badgeId: { type: ["string", "null"] },
              badgeName: { type: ["string", "null"] },
              badgeIconUrl: { type: ["string", "null"] },
              courseName: { type: ["string", "null"] },
              rewardType: { type: ["integer", "null"] },
              points: { type: ["number", "null"] },
              pointsTarget: { type: ["number", "null"] },
              startDateTarget: { type: ["string", "null"], format: "date-time" },
              endDateTarget: { type: ["string", "null"], format: "date-time" },
            },
          },
        },
        required: [
          "id",
          "userId",
          "goalRewardId",
          "courseId",
          "progress",
          "isCompleted",
          "rewardClaimed",
          "user",
          "goal",
          "reward",
        ],
      },
    },
  },
} as const;

export function mergeOpenApiFragments(fragments: OpenApiFragment[]) {
  const merged = {
    ...baseOpenApiSpec,
    tags: [...baseOpenApiSpec.tags] as Array<Record<string, unknown>>,
    paths: {} as Record<string, unknown>,
    components: {
      ...baseOpenApiSpec.components,
      schemas: { ...baseOpenApiSpec.components.schemas },
    } as Record<string, unknown>,
  };

  for (const fragment of fragments) {
    if (fragment.tags) {
      merged.tags.push(...fragment.tags);
    }

    if (fragment.paths) {
      Object.assign(merged.paths, fragment.paths);
    }

    if (fragment.components) {
      const fragmentComponents = fragment.components;
      for (const [key, value] of Object.entries(fragmentComponents)) {
        const current = merged.components[key];
        if (
          current &&
          typeof current === "object" &&
          !Array.isArray(current) &&
          value &&
          typeof value === "object" &&
          !Array.isArray(value)
        ) {
          merged.components[key] = {
            ...(current as Record<string, unknown>),
            ...(value as Record<string, unknown>),
          };
        } else {
          merged.components[key] = value;
        }
      }
    }
  }

  return merged;
}
