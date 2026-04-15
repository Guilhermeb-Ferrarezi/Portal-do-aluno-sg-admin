import type { ActivityLog } from "../services/api";

function buildCommonPayload(log: ActivityLog) {
  return {
    id: log.id,
    actor: log.actor ?? { id: null, name: null, email: null, role: null },
    action: log.action,
    entity: {
      type: log.entityType,
      id: log.entityId,
    },
    request: {
      method: log.method,
      endpoint: log.endpoint,
      statusCode: log.statusCode,
      responseTimeMs: log.responseTimeMs,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      body: log.requestBody ?? null,
    },
    response: {
      statusCode: log.statusCode,
      body: log.responseBody ?? null,
    },
    metadata: log.metadata,
    createdAt: log.createdAt,
  };
}

export function buildActivityLogPayload(log: ActivityLog) {
  return buildCommonPayload(log);
}
