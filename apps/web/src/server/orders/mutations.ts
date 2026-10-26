import { and, eq } from "drizzle-orm";

import type { Db } from "@/server/db/types";
import {
  orderEvents,
  orders,
  printJobs,
  whatsappTasks,
  type OrderStatus,
} from "@/server/db/schema";
import { canTransitionStatus, orderStatusLabel } from "@/server/orders/status";

export type UpdateStatusFailure = "not_found" | "invalid_transition";

export type UpdateStatusResult =
  | { ok: true }
  | { ok: false; reason: UpdateStatusFailure; message: string };

type UpdateStatusOptions = {
  actorUserId: string | null;
  reason?: string;
  now?: Date;
};

/**
 * Mudança de status com histórico na mesma transação. Ao cancelar, também
 * encerra trabalho de impressão ainda pendente e tarefa de WhatsApp não enviada.
 */
export async function updateOrderStatus(
  db: Db,
  restaurantId: string,
  orderId: string,
  nextStatus: OrderStatus,
  { actorUserId, reason = "", now = new Date() }: UpdateStatusOptions,
): Promise<UpdateStatusResult> {
  const [order] = await db
    .select({
      id: orders.id,
      status: orders.status,
      type: orders.type,
    })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.restaurantId, restaurantId)))
    .limit(1);

  if (!order) {
    return {
      ok: false,
      reason: "not_found",
      message: "Pedido não encontrado neste restaurante. Recarregue a página.",
    };
  }

  if (!canTransitionStatus(order.status, nextStatus, order.type)) {
    return {
      ok: false,
      reason: "invalid_transition",
      message: `Não é possível mudar de "${orderStatusLabel(
        order.status,
        order.type,
      )}" para "${orderStatusLabel(nextStatus, order.type)}".`,
    };
  }

  const cleanReason = reason.trim().slice(0, 300);

  await db.transaction(async (tx) => {
    const patch: Partial<typeof orders.$inferInsert> = {
      status: nextStatus,
      updatedAt: now,
    };

    switch (nextStatus) {
      case "confirmed":
        patch.confirmedAt = now;
        break;
      case "ready":
        patch.readyAt = now;
        break;
      case "out_for_delivery":
        patch.dispatchedAt = now;
        break;
      case "delivered":
        patch.deliveredAt = now;
        break;
      case "canceled":
        patch.canceledAt = now;
        patch.cancelReason = cleanReason;
        break;
      case "pending":
      case "preparing":
        break;
    }

    await tx
      .update(orders)
      .set(patch)
      .where(and(eq(orders.id, orderId), eq(orders.restaurantId, restaurantId)));

    await tx.insert(orderEvents).values({
      orderId,
      status: nextStatus,
      note:
        nextStatus === "canceled"
          ? cleanReason.length > 0
            ? `Cancelado: ${cleanReason}`
            : "Cancelado pelo painel."
          : `Status alterado para ${orderStatusLabel(nextStatus, order.type)}.`,
      actorUserId,
      createdAt: now,
    });

    if (nextStatus === "canceled") {
      await tx
        .update(printJobs)
        .set({ status: "canceled", updatedAt: now })
        .where(and(eq(printJobs.orderId, orderId), eq(printJobs.status, "pending")));

      await tx
        .update(whatsappTasks)
        .set({ status: "skipped", updatedAt: now })
        .where(and(eq(whatsappTasks.orderId, orderId), eq(whatsappTasks.status, "pending")));
    }
  });

  return { ok: true };
}
