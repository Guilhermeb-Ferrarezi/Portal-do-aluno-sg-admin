import { apiFetch } from "./core";

export type ActivityLog = {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  actorNome: string | null;
  actorUsuario: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export async function listarActivityLogs(params: {
  limit?: number;
  offset?: number;
  action?: string;
  entityType?: string;
  actorId?: string;
  actorGroup?: "user" | "staff";
  q?: string;
  from?: string;
  to?: string;
}) {
  const search = new URLSearchParams();
  if (params.limit) search.set("limit", String(params.limit));
  if (params.offset) search.set("offset", String(params.offset));
  if (params.action) search.set("action", params.action);
  if (params.entityType) search.set("entityType", params.entityType);
  if (params.actorId) search.set("actorId", params.actorId);
  if (params.actorGroup) search.set("actorGroup", params.actorGroup);
  if (params.q) search.set("q", params.q);
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);

  const query = search.toString();
  return apiFetch<{ items: ActivityLog[]; total: number }>(
    `/activity-logs${query ? `?${query}` : ""}`
  );
}
