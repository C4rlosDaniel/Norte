import { describe, expect, it } from "vitest";

import {
  canTransitionStatus,
  nextOrderStatuses,
  orderStatusLabel,
  orderTypeLabel,
  paymentMethodLabel,
} from "@/server/orders/status";

describe("máquina de estados do pedido", () => {
  it("aceita o fluxo de entrega", () => {
    expect(canTransitionStatus("pending", "confirmed", "delivery")).toBe(true);
    expect(canTransitionStatus("confirmed", "preparing", "delivery")).toBe(true);
    expect(canTransitionStatus("preparing", "ready", "delivery")).toBe(true);
    expect(canTransitionStatus("ready", "out_for_delivery", "delivery")).toBe(true);
    expect(canTransitionStatus("out_for_delivery", "delivered", "delivery")).toBe(true);
  });

  it("na retirada, pronto vai direto para retirado", () => {
    expect(nextOrderStatuses("ready", "pickup")).toEqual(["delivered", "canceled"]);
    expect(canTransitionStatus("ready", "out_for_delivery", "pickup")).toBe(false);
  });

  it("não pula etapas nem volta", () => {
    expect(canTransitionStatus("pending", "preparing", "delivery")).toBe(false);
    expect(canTransitionStatus("delivered", "canceled", "delivery")).toBe(false);
    expect(nextOrderStatuses("canceled", "delivery")).toEqual([]);
  });

  it("permite cancelar enquanto o pedido está ativo", () => {
    for (const status of ["pending", "confirmed", "preparing", "ready"] as const) {
      expect(canTransitionStatus(status, "canceled", "delivery")).toBe(true);
    }
  });
});

describe("rótulos", () => {
  it("diferencia entregue de retirado", () => {
    expect(orderStatusLabel("delivered", "delivery")).toBe("Entregue");
    expect(orderStatusLabel("delivered", "pickup")).toBe("Retirado");
  });

  it("traduz tipo e pagamento", () => {
    expect(orderTypeLabel("delivery")).toBe("Entrega");
    expect(orderTypeLabel("pickup")).toBe("Retirada");
    expect(paymentMethodLabel("cash")).toBe("Dinheiro");
    expect(paymentMethodLabel("card")).toBe("Cartão");
    expect(paymentMethodLabel("pix")).toBe("Pix");
  });
});
