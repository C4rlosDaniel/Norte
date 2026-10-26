/**
 * Regras de horário de funcionamento.
 *
 * Tudo é calculado no fuso do restaurante (nunca no fuso do servidor) e
 * representado em minutos desde a meia-noite local. Períodos que cruzam a
 * meia-noite são suportados: o período de ontem continua valendo de madrugada.
 */

export type BusinessHourRow = {
  weekday: number;
  /** "HH:MM" ou "HH:MM:SS" (formato devolvido pelo Postgres) */
  opensAt: string;
  closesAt: string;
  acceptsDeliveryUntil: string | null;
  isClosed: boolean;
};

export type OpenReason = "open" | "manual_closed" | "outside_hours" | "no_schedule";

export type OpenState = {
  isOpen: boolean;
  deliveryAllowed: boolean;
  reason: OpenReason;
  /** "22:00" quando está aberto */
  closesAtLabel: string | null;
  /** "hoje às 18:00" / "amanhã às 11:00" / "segunda-feira às 11:00" */
  nextOpenLabel: string | null;
};

export const WEEKDAY_LABELS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
] as const;

const WEEKDAY_SHORT_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const MINUTES_IN_DAY = 24 * 60;

export function parseTimeToMinutes(value: string): number {
  const [hours = "0", minutes = "0"] = value.split(":");
  const h = Number(hours);
  const m = Number(minutes);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

export function formatMinutes(minutes: number): string {
  const normalized = ((minutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function localWeekdayAndMinutes(
  now: Date,
  timeZone: string,
): { weekday: number; minutes: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(now);
  const weekday = WEEKDAY_SHORT_TO_INDEX[parts.find((p) => p.type === "weekday")?.value ?? "Sun"] ?? 0;
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");

  return { weekday, minutes: hour * 60 + minute };
}

type Interval = {
  day: number;
  start: number;
  end: number;
  deliveryCutoff: number | null;
};

/** Converte as linhas de um dia em intervalos absolutos (podem passar de 1440). */
function intervalsFor(rows: readonly BusinessHourRow[], weekday: number): Interval[] {
  return rows
    .filter((row) => row.weekday === weekday && !row.isClosed)
    .map((row) => {
      const start = parseTimeToMinutes(row.opensAt);
      let end = parseTimeToMinutes(row.closesAt);
      if (end <= start) end += MINUTES_IN_DAY;

      let deliveryCutoff: number | null = null;
      if (row.acceptsDeliveryUntil) {
        const cutoff = parseTimeToMinutes(row.acceptsDeliveryUntil);
        deliveryCutoff = cutoff <= start ? cutoff + MINUTES_IN_DAY : cutoff;
      }

      return { day: weekday, start, end, deliveryCutoff };
    })
    .sort((a, b) => a.start - b.start);
}

function shifts(rows: readonly BusinessHourRow[], weekday: number): Interval[] {
  const yesterday = (weekday + 6) % 7;

  // O período de ontem que cruza a meia-noite vale hoje de madrugada.
  // Deslocamos ontem em -1440 para comparar com os minutos de hoje.
  const overnightFromYesterday = intervalsFor(rows, yesterday)
    .filter((interval) => interval.end > MINUTES_IN_DAY)
    .map((interval) => ({
      ...interval,
      start: interval.start - MINUTES_IN_DAY,
      end: interval.end - MINUTES_IN_DAY,
      deliveryCutoff:
        interval.deliveryCutoff === null ? null : interval.deliveryCutoff - MINUTES_IN_DAY,
    }));

  return [...intervalsFor(rows, weekday), ...overnightFromYesterday];
}

function findActiveInterval(rows: readonly BusinessHourRow[], weekday: number, minutes: number) {
  return shifts(rows, weekday).find((i) => minutes >= i.start && minutes < i.end) ?? null;
}

function nextOpenLabel(rows: readonly BusinessHourRow[], weekday: number, minutes: number): string | null {
  for (let offset = 0; offset <= 7; offset += 1) {
    const day = (weekday + offset) % 7;
    const dayIntervals = intervalsFor(rows, day).map((i) => ({
      ...i,
      start: i.start + offset * MINUTES_IN_DAY,
      end: i.end + offset * MINUTES_IN_DAY,
    }));

    const candidate = dayIntervals.find((i) => i.start > minutes);
    if (!candidate) continue;

    const time = formatMinutes(candidate.start);
    if (offset === 0) return `hoje às ${time}`;
    if (offset === 1) return `amanhã às ${time}`;
    return `${WEEKDAY_LABELS[day]} às ${time}`;
  }

  return null;
}

export function evaluateOpenState(input: {
  hours: readonly BusinessHourRow[];
  now: Date;
  timeZone: string;
  manuallyClosed: boolean;
  deliveryEnabled: boolean;
}): OpenState {
  const { hours, now, timeZone, manuallyClosed, deliveryEnabled } = input;
  const { weekday, minutes } = localWeekdayAndMinutes(now, timeZone);

  if (hours.length === 0) {
    return {
      isOpen: false,
      deliveryAllowed: false,
      reason: "no_schedule",
      closesAtLabel: null,
      nextOpenLabel: null,
    };
  }

  if (manuallyClosed) {
    return {
      isOpen: false,
      deliveryAllowed: false,
      reason: "manual_closed",
      closesAtLabel: null,
      nextOpenLabel: null,
    };
  }

  const active = findActiveInterval(hours, weekday, minutes);

  if (!active) {
    return {
      isOpen: false,
      deliveryAllowed: false,
      reason: "outside_hours",
      closesAtLabel: null,
      nextOpenLabel: nextOpenLabel(hours, weekday, minutes),
    };
  }

  const withinCutoff = active.deliveryCutoff === null || minutes < active.deliveryCutoff;

  return {
    isOpen: true,
    deliveryAllowed: deliveryEnabled && withinCutoff,
    reason: "open",
    closesAtLabel: formatMinutes(active.end),
    nextOpenLabel: null,
  };
}
