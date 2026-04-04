import { apiFetch } from "./core";

export type Badge = {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  createdAt: string;
  holdersCount?: number;
};

export type BadgeHolder = {
  holderId: string;
  badgeId: string;
  badgeName: string;
  user: {
    id: string;
    nome: string;
    email: string;
  };
  awardedAt: string;
};

export async function listarBadges(params?: {
  q?: string;
  limit?: number;
  offset?: number;
}) {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  const query = search.toString();
  return apiFetch<{ items: Badge[]; total: number }>(`/badges${query ? `?${query}` : ""}`);
}

export async function criarBadge(dados: {
  name: string;
  description: string;
  iconUrl: string;
}) {
  return apiFetch<{ message: string; badge: Badge }>("/badges", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export async function atualizarBadge(
  id: string,
  dados: {
    name?: string;
    description?: string;
    iconUrl?: string;
  }
) {
  return apiFetch<{ message: string; badge: Badge }>(`/badges/${id}`, {
    method: "PUT",
    body: JSON.stringify(dados),
  });
}

export async function deletarBadge(id: string) {
  return apiFetch<{ message: string }>(`/badges/${id}`, {
    method: "DELETE",
  });
}

export async function listarBadgeHolders(params?: {
  badgeId?: string;
  limit?: number;
  offset?: number;
}) {
  const search = new URLSearchParams();
  if (params?.badgeId) search.set("badgeId", params.badgeId);
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  const query = search.toString();
  return apiFetch<{ items: BadgeHolder[]; total: number }>(
    `/badges/holders${query ? `?${query}` : ""}`
  );
}

export async function atualizarBadgeDoUsuario(holderId: string, badgeId: string) {
  return apiFetch<{ message: string; holder: BadgeHolder }>(`/badges/holders/${holderId}`, {
    method: "PUT",
    body: JSON.stringify({ badgeId }),
  });
}

export async function atribuirBadgeAoUsuario(userId: string, badgeId: string) {
  return apiFetch<{ message: string; holder: BadgeHolder }>("/badges/holders", {
    method: "POST",
    body: JSON.stringify({ userId, badgeId }),
  });
}

export async function removerBadgeDoUsuario(holderId: string) {
  return apiFetch<{ message: string }>(`/badges/holders/${holderId}`, {
    method: "DELETE",
  });
}
