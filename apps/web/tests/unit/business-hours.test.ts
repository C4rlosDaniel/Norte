import { describe, expect, it } from "vitest";

import { evaluateOpenState, type BusinessHourRow } from "@/server/restaurant/business-hours";

const TIMEZONE = "America/Sao_Paulo";

const weekday = (day: number): BusinessHourRow => ({
  weekday: day,
  opensAt: "11:00:00",
  closesAt: "22:00:00",
  acceptsDeliveryUntil: "20:30:00",
  isClosed: false,
});

const standardWeek: BusinessHourRow[] = [
  weekday(0),
  weekday(1),
  weekday(2),
  weekday(3),
  weekday(4),
  weekday(5),
  weekday(6),
];

function stateAt(
  iso: string,
  options: {
    hours?: BusinessHourRow[];
    manuallyClosed?: boolean;
    deliveryEnabled?: boolean;
  } = {},
) {
  return evaluateOpenState({
    hours: options.hours ?? standardWeek,
    now: new Date(iso),
    timeZone: TIMEZONE,
    manuallyClosed: options.manuallyClosed ?? false,
    deliveryEnabled: options.deliveryEnabled ?? true,
  });
}

describe("evaluateOpenState", () => {
  it("abre no horário local do restaurante (segunda 12:00 em São Paulo)", () => {
    // 2026-10-26 é segunda-feira. 15:00Z = 12:00 em São Paulo.
    const state = stateAt("2026-10-26T15:00:00Z");

    expect(state.isOpen).toBe(true);
    expect(state.reason).toBe("open");
    expect(state.closesAtLabel).toBe("22:00");
    expect(state.deliveryAllowed).toBe(true);
    expect(state.nextOpenLabel).toBeNull();
  });

  it("fecha depois do horário e informa quando abre de novo", () => {
    // 01:30Z de terça = 22:30 de segunda em São Paulo.
    const state = stateAt("2026-10-27T01:30:00Z");

    expect(state.isOpen).toBe(false);
    expect(state.reason).toBe("outside_hours");
    expect(state.nextOpenLabel).toBe("amanhã às 11:00");
  });

  it("respeita o horário limite de entrega sem fechar o restaurante", () => {
    // 00:00Z de terça = 21:00 de segunda.
    const state = stateAt("2026-10-27T00:00:00Z");

    expect(state.isOpen).toBe(true);
    expect(state.deliveryAllowed).toBe(false);
  });

  it("fecha quando o restaurante foi fechado manualmente", () => {
    const state = stateAt("2026-10-26T15:00:00Z", { manuallyClosed: true });

    expect(state.isOpen).toBe(false);
    expect(state.reason).toBe("manual_closed");
    expect(state.deliveryAllowed).toBe(false);
  });

  it("não aceita entrega quando a entrega está desativada", () => {
    const state = stateAt("2026-10-26T15:00:00Z", { deliveryEnabled: false });

    expect(state.isOpen).toBe(true);
    expect(state.deliveryAllowed).toBe(false);
  });

  it("domingo com linha marcada como fechada não abre", () => {
    // 2026-10-25 é domingo, 13:00Z = 10:00 em São Paulo.
    const sundayClosed = { ...weekday(0), isClosed: true };
    const state = stateAt("2026-10-25T13:00:00Z", {
      hours: [sundayClosed, ...standardWeek.filter((row) => row.weekday !== 0)],
    });

    expect(state.isOpen).toBe(false);
    expect(state.reason).toBe("outside_hours");
    expect(state.nextOpenLabel).toBe("amanhã às 11:00");
  });

  it("retorna no_schedule quando não existe nenhum horário", () => {
    const state = stateAt("2026-10-26T15:00:00Z", { hours: [] });

    expect(state.isOpen).toBe(false);
    expect(state.reason).toBe("no_schedule");
  });

  it("suporta período que cruza a meia-noite (sexta 18:00 até sábado 02:00)", () => {
    const overnight: BusinessHourRow[] = [
      {
        weekday: 5,
        opensAt: "18:00:00",
        closesAt: "02:00:00",
        acceptsDeliveryUntil: "01:00:00",
        isClosed: false,
      },
    ];

    // Sábado 2026-10-31, 04:00Z = 01:00 em São Paulo.
    const atMidnight = evaluateOpenState({
      hours: overnight,
      now: new Date("2026-10-31T04:00:00Z"),
      timeZone: TIMEZONE,
      manuallyClosed: false,
      deliveryEnabled: true,
    });

    expect(atMidnight.isOpen).toBe(true);
    expect(atMidnight.closesAtLabel).toBe("02:00");
    expect(atMidnight.deliveryAllowed).toBe(false);

    // Sábado 00:30 em São Paulo ainda aceita entrega.
    const earlier = evaluateOpenState({
      hours: overnight,
      now: new Date("2026-10-31T03:30:00Z"),
      timeZone: TIMEZONE,
      manuallyClosed: false,
      deliveryEnabled: true,
    });

    expect(earlier.isOpen).toBe(true);
    expect(earlier.deliveryAllowed).toBe(true);

    // Sábado 02:30 em São Paulo já fechou.
    const afterClose = evaluateOpenState({
      hours: overnight,
      now: new Date("2026-10-31T05:30:00Z"),
      timeZone: TIMEZONE,
      manuallyClosed: false,
      deliveryEnabled: true,
    });

    expect(afterClose.isOpen).toBe(false);
  });

  it("escolhe o próximo período do mesmo dia", () => {
    const splitShift: BusinessHourRow[] = [
      { weekday: 1, opensAt: "11:00:00", closesAt: "15:00:00", acceptsDeliveryUntil: null, isClosed: false },
      { weekday: 1, opensAt: "18:00:00", closesAt: "23:00:00", acceptsDeliveryUntil: null, isClosed: false },
    ];

    // Segunda 16:00 em São Paulo = 19:00Z.
    const state = stateAt("2026-10-26T19:00:00Z", { hours: splitShift });

    expect(state.isOpen).toBe(false);
    expect(state.nextOpenLabel).toBe("hoje às 18:00");
  });
});
