const ptBrShort = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export function formatDateShort(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "" : ptBrShort.format(d);
}

export function formatRelativeTime(timestamp: number, now = Date.now()) {
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

  return ptBrShort.format(new Date(timestamp));
}

export function truncateText(value: string | null | undefined, max = 40) {
  if (!value) return "";
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

export function getFileExtension(value: string): string | null {
  const match = value.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
  return match ? match[1].toLowerCase() : null;
}
