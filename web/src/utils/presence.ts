const PRESENCE_STALE_AFTER_MS = 90_000;

export function getPresenceTimestamp(lastSeenAt?: string | null): number | null {
  if (!lastSeenAt) return null;
  const parsed = Date.parse(lastSeenAt);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isPresenceStillOnline(
  isOnline: boolean | undefined,
  lastSeenAt?: string | null,
  now = Date.now()
) {
  if (!isOnline) return false;
  const timestamp = getPresenceTimestamp(lastSeenAt);
  if (timestamp === null) return false;
  return now - timestamp <= PRESENCE_STALE_AFTER_MS;
}

export function formatRelativeActivity(
  lastSeenAt?: string | null,
  isOnline?: boolean,
  now = Date.now()
) {
  if (isOnline) return "Agora";

  const timestamp = getPresenceTimestamp(lastSeenAt);
  if (timestamp === null) return "Sem atividade";

  const diffMs = Math.max(0, now - timestamp);
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return "Agora";
  if (diffMinutes < 60) return `${diffMinutes}min atras`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h atras`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} dia${diffDays === 1 ? "" : "s"} atras`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks} semana${diffWeeks === 1 ? "" : "s"} atras`;

  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(timestamp));
}
