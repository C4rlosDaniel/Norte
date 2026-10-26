const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  const cached = dateTimeFormatterCache.get(timeZone);
  if (cached) return cached;

  const created = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone,
  });
  dateTimeFormatterCache.set(timeZone, created);
  return created;
}

export function formatDateTime(value: Date | string, timeZone: string): string {
  return formatter(timeZone).format(typeof value === "string" ? new Date(value) : value);
}

export function formatTime(value: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(typeof value === "string" ? new Date(value) : value);
}
