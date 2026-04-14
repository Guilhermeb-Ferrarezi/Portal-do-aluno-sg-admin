import { apiFetch, type PaginatedItemsResponse } from "./core";

export type NotificationTemplate = {
  id: number;
  nome: string;
  tituloTemplate: string;
  mensagemTemplate: string;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type NotificationDispatch = {
  id: number;
  templateId: number;
  templateName: string;
  triggeredByActorName: string | null;
  triggeredByActorEmail: string | null;
  cursoIds: number[];
  turmaIds: number[];
  alunoIds: number[];
  totalRecipients: number;
  failedRecipients: number;
  createdAt: string;
};

export async function listarTemplatesNotificacao() {
  return apiFetch<{ items: NotificationTemplate[] }>("/notifications/templates");
}

export async function criarTemplateNotificacao(payload: {
  nome: string;
  tituloTemplate: string;
  mensagemTemplate: string;
  ativo: boolean;
}) {
  return apiFetch<{ template: NotificationTemplate }>("/notifications/templates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function atualizarTemplateNotificacao(
  id: number,
  payload: {
    nome: string;
    tituloTemplate: string;
    mensagemTemplate: string;
    ativo: boolean;
  }
) {
  return apiFetch<{ template: NotificationTemplate }>(`/notifications/templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deletarTemplateNotificacao(id: number) {
  return apiFetch<{ success: true }>(`/notifications/templates/${id}`, {
    method: "DELETE",
  });
}

export async function listarDisparosNotificacao(params?: {
  limit?: number;
  offset?: number;
  q?: string;
}) {
  const searchParams = new URLSearchParams();

  if (params?.limit) {
    searchParams.set("limit", String(params.limit));
  }

  if (params?.offset) {
    searchParams.set("offset", String(params.offset));
  }

  if (params?.q?.trim()) {
    searchParams.set("q", params.q.trim());
  }

  const queryString = searchParams.toString();

  return apiFetch<PaginatedItemsResponse<NotificationDispatch>>(
    `/notifications/dispatches${queryString ? `?${queryString}` : ""}`
  );
}

export async function deletarDisparoNotificacao(id: number) {
  return apiFetch<{ success: true }>(`/notifications/dispatches/${id}`, {
    method: "DELETE",
  });
}

export async function dispararTemplateNotificacao(
  id: number,
  payload: {
    cursoIds: number[];
    turmaIds: number[];
    alunoIds: number[];
  }
) {
  return apiFetch<{
    dispatch: {
      id: number;
      templateId: number;
      templateName: string;
      totalRecipients: number;
      failedRecipients: number;
      createdAt: string;
    };
  }>(`/notifications/templates/${id}/dispatch`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
