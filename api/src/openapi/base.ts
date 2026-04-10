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
      "Documentacao operacional da API do Portal do Aluno. O servidor suporta uso com e sem prefixo /api.",
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
    { name: "Activity Logs", description: "Auditoria administrativa" },
    { name: "Badges", description: "Medalhas e atribuicoes" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
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
