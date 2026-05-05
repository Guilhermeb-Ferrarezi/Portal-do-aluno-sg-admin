import { env } from "@/env";
import { buildJsonHeaders, handleUnauthorized, parseError } from "./core";

const BASE = env.pointsApiUrl;

export type CustomResponse<T> = {
  success: boolean;
  errors: string[];
  result: T;
  totalRows?: number | null;
};

export type RankingEventType = 1 | 2 | 3;

export const RANKING_EVENT_TYPE = {
  Notas: 1 as const,
  Pontos: 2 as const,
  Outro: 3 as const,
};

export const RANKING_EVENT_TYPE_LABEL: Record<RankingEventType, string> = {
  1: "Notas",
  2: "Pontos",
  3: "Outro",
};

export type PointRanking = {
  userId: number;
  totalPoints: number;
  name: string;
  profilePictureUrl?: string | null;
};

export type CategoryRankingEntry = {
  userId: number;
  name: string;
  profilePictureUrl?: string | null;
  percentAvailable: number;
  totalAnswers: number;
  status: "Não Iniciado" | "Em Progresso" | "Desbloqueado" | null;
};

export type RankingPerCategory = {
  category: string;
  rankings: CategoryRankingEntry[];
};

export type RankingCategory = {
  id: number;
  category: string;
};

export type PageResult<T> = {
  items: T;
  totalRows: number | null;
};

export type RankingEventAward = {
  id?: number;
  awardName: string;
  awardPositionRanking: number;
  awardDescription: string;
  awardPictureUrl: string;
};

export type RankingEventListItem = {
  id: number;
  eventName: string;
  eventType: string | RankingEventType;
  durationMinutes: number;
  startTime: string;
  endTime: string;
  eventRankingAwards: RankingEventAward[];
  awards?: RankingEventAward[];
};

export type RankingEventInput = {
  eventName: string;
  eventType: RankingEventType;
  durationMinutes: number;
  startTime: string;
  awards: RankingEventAward[];
};

export type RankingEventResponse = {
  id: number;
  eventName: string;
  eventType: RankingEventType;
  durationMinutes: number;
  startTime: string;
  endTime: string;
  awards: RankingEventAward[];
};

export type RankingEventHistoryItem = {
  id: number;
  eventId: number;
  eventName: string;
  eventType: string;
  userId: number;
  userName: string;
  userProfilePictureUrl?: string | null;
  awardId: number;
  awardName: string;
  awardDescription: string;
  awardPictureUrl: string;
  rankingPosition: number;
  recordedAt: string;
};

async function pointsFetch<T>(path: string, options: RequestInit = {}) {
  const headers = await buildJsonHeaders(options.headers);
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const message = await parseError(res);
    if (res.status === 401) handleUnauthorized(message);
    throw new Error(message);
  }
  if (res.status === 204) return null as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

function unwrap<T>(response: CustomResponse<T> | null): T {
  if (!response) {
    throw new Error("Resposta vazia do servidor");
  }
  if (!response.success) {
    const message = response.errors?.join("; ") || "Falha na requisição";
    throw new Error(message);
  }
  return response.result;
}

function unwrapPage<T>(response: CustomResponse<T> | null): PageResult<T> {
  if (!response) {
    throw new Error("Resposta vazia do servidor");
  }
  if (!response.success) {
    const message = response.errors?.join("; ") || "Falha na requisição";
    throw new Error(message);
  }
  return {
    items: response.result,
    totalRows: response.totalRows ?? null,
  };
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  const value = query.toString();
  return value ? `?${value}` : "";
}

function normalizeRankingEvent(item: RankingEventListItem): RankingEventListItem {
  return {
    ...item,
    eventType:
      typeof item.eventType === "number"
        ? RANKING_EVENT_TYPE_LABEL[item.eventType] ?? String(item.eventType)
        : item.eventType,
    eventRankingAwards: item.eventRankingAwards ?? item.awards ?? [],
  };
}

export async function getRankingPoints() {
  const res = await pointsFetch<CustomResponse<PointRanking[]>>(
   `/Point/GetRankingPoints`
  );
  return unwrap(res);
}

export async function getRankingCategories() {
  const res = await pointsFetch<CustomResponse<RankingCategory[]>>(
    "/Point/RankingCategories"
  );
  return unwrap(res);
}

export async function getAvailableRankingPerCategory(params?: {
  category?: string;
  limit?: number;
  offset?: number;
}) {
  const query = buildQuery({
    category: params?.category,
    limit: params?.limit,
    offset: params?.offset,
  });
  const res = await pointsFetch<CustomResponse<RankingPerCategory[]>>(
    `/Point/GetAvailableRankingPerCategory${query}`
  );
  return unwrap(res);
}

export async function getAvailableRankingPerCategoryPage(params: {
  category: string;
  limit: number;
  offset: number;
}) {
  const query = buildQuery(params);
  const res = await pointsFetch<CustomResponse<RankingPerCategory[]>>(
    `/Point/GetAvailableRankingPerCategory${query}`
  );
  return unwrapPage(res);
}

export async function getRankingEventsByType(eventType: RankingEventType) {
  const res = await pointsFetch<CustomResponse<RankingEventListItem[]>>(
    `/Point/GetRankingEvent?eventType=${eventType}`
  );
  return unwrap(res).map(normalizeRankingEvent);
}

export async function getRankingEventHistory(
  eventType?: RankingEventType,
  params?: { limit?: number; offset?: number }
) {
  const query = buildQuery({
    eventType,
    limit: params?.limit,
    offset: params?.offset,
  });
  const res = await pointsFetch<CustomResponse<RankingEventHistoryItem[]>>(
    `/Point/RankingEventHistory${query}`
  );
  return unwrap(res);
}

export async function getRankingEventHistoryPage(
  eventType: RankingEventType | undefined,
  params: { limit: number; offset: number }
) {
  const query = buildQuery({
    eventType,
    limit: params.limit,
    offset: params.offset,
  });
  const res = await pointsFetch<CustomResponse<RankingEventHistoryItem[]>>(
    `/Point/RankingEventHistory${query}`
  );
  return unwrapPage(res);
}

export async function scheduleRankingEvent(eventId: number) {
  const res = await pointsFetch<CustomResponse<boolean>>(
    "/Point/ScheduleRankingEvent",
    {
      method: "POST",
      body: JSON.stringify(eventId),
    }
  );
  return unwrap(res);
}

export async function criarRankingEvent(data: RankingEventInput) {
  const res = await pointsFetch<CustomResponse<RankingEventResponse>>(
    "/Point/RankingEvent",
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
  return unwrap(res);
}

export async function atualizarRankingEvent(
  id: number,
  data: RankingEventInput
) {
  const res = await pointsFetch<CustomResponse<RankingEventResponse>>(
    `/Point/RankingEvent/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
  return unwrap(res);
}

export async function deletarRankingEvent(id: number) {
  const res = await pointsFetch<CustomResponse<boolean>>(
    `/Point/RankingEvent/${id}`,
    { method: "DELETE" }
  );
  return unwrap(res);
}
