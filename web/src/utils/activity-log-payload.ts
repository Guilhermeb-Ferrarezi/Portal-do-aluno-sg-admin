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
      requestId: log.requestId,
      method: log.method,
      endpoint: log.endpoint,
      route: log.route,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      body: log.requestBody ?? null,
    },
    response: {
      statusCode: log.statusCode,
      responseTimeMs: log.responseTimeMs,
      outcome: log.outcome,
      errorType: log.errorType,
      source: log.source,
      contextArea: log.contextArea,
      body: log.responseBody ?? null,
    },
    metadata: log.metadata,
    createdAt: log.createdAt,
  };
}

export function buildActivityLogPayload(log: ActivityLog) {
  return buildCommonPayload(log);
}
