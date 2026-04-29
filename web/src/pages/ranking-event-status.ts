export type EventStatus = "Agendado" | "Ativo" | "Encerrado";

export function computeEventStatus(
  startTimeIso: string,
  durationMinutes: number
): EventStatus {
  const normalizedStartTime = /(?:Z|[+-]\d{2}:\d{2})$/.test(startTimeIso)
    ? startTimeIso
    : `${startTimeIso}Z`;
  const startMs = new Date(normalizedStartTime).getTime();
  if (Number.isNaN(startMs)) return "Agendado";

  const nowMs = Date.now();
  const endMs = startMs + durationMinutes * 60_000;

  if (nowMs < startMs) return "Agendado";
  if (nowMs <= endMs) return "Ativo";
  return "Encerrado";
}
