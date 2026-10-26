import type { OrderStatus, OrderType } from "@/server/db/schema";

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "canceled",
];

/** Estados que aceitam pedidos na fila do painel. */
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
];

export function orderStatusLabel(status: OrderStatus, type?: OrderType): string {
  switch (status) {
    case "pending":
      return "Novo";
    case "confirmed":
      return "Confirmado";
    case "preparing":
      return "Em preparo";
    case "ready":
      return "Pronto";
    case "out_for_delivery":
      return "Saiu para entrega";
    case "delivered":
      return type === "pickup" ? "Retirado" : "Entregue";
    case "canceled":
      return "Cancelado";
  }
}

export function orderTypeLabel(type: OrderType): string {
  return type === "delivery" ? "Entrega" : "Retirada";
}

export function paymentMethodLabel(method: "cash" | "card" | "pix"): string {
  switch (method) {
    case "cash":
      return "Dinheiro";
    case "card":
      return "Cartão";
    case "pix":
      return "Pix";
  }
}

/**
 * Máquina de estados enxuta e explícita: nada volta, nada pula etapa.
 * `delivered` e `canceled` são terminais.
 */
export function nextOrderStatuses(status: OrderStatus, type: OrderType): OrderStatus[] {
  switch (status) {
    case "pending":
      return ["confirmed", "canceled"];
    case "confirmed":
      return ["preparing", "canceled"];
    case "preparing":
      return ["ready", "canceled"];
    case "ready":
      return type === "delivery" ? ["out_for_delivery", "canceled"] : ["delivered", "canceled"];
    case "out_for_delivery":
      return ["delivered", "canceled"];
    case "delivered":
    case "canceled":
      return [];
  }
}

export function canTransitionStatus(
  from: OrderStatus,
  to: OrderStatus,
  type: OrderType,
): boolean {
  return nextOrderStatuses(from, type).includes(to);
}

export function orderStatusBadgeClass(status: OrderStatus): string {
  switch (status) {
    case "pending":
      return "bg-sun/30 text-leather";
    case "confirmed":
      return "bg-cactus/20 text-cactus";
    case "preparing":
      return "bg-terracotta/15 text-terracotta";
    case "ready":
      return "bg-cactus/30 text-cactus";
    case "out_for_delivery":
      return "bg-leather/15 text-leather";
    case "delivered":
      return "bg-leather/10 text-ink-soft";
    case "canceled":
      return "bg-terracotta/15 text-terracotta";
  }
}
