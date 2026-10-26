"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireMember } from "@/server/auth/require-member";
import { getDb } from "@/server/db/client";
import type { OrderStatus } from "@/server/db/schema";
import { log } from "@/server/logger";
import { updateOrderStatus } from "@/server/orders/mutations";
import { ORDER_STATUSES } from "@/server/orders/status";

export async function updateOrderStatusAction(formData: FormData): Promise<void> {
  const member = await requireMember();
  const db = getDb();

  const orderIdRaw = String(formData.get("orderId") ?? "");
  const orderId = z.string().uuid().safeParse(orderIdRaw);

  if (!orderId.success) {
    redirect("/painel/pedidos?erro=Pedido%20inv%C3%A1lido.");
  }

  const statusRaw = String(formData.get("status") ?? "");
  if (!ORDER_STATUSES.includes(statusRaw as OrderStatus)) {
    redirect(
      `/painel/pedidos/${orderId.data}?erro=${encodeURIComponent("Status inválido.")}`,
    );
  }

  const reason = String(formData.get("reason") ?? "").slice(0, 300);

  let result: Awaited<ReturnType<typeof updateOrderStatus>>;
  try {
    result = await updateOrderStatus(db, member.restaurantId, orderId.data, statusRaw as OrderStatus, {
      actorUserId: member.userId,
      reason,
    });
  } catch (error) {
    log("error", "order_status_update_failed", {
      orderId: orderId.data,
      errorName: error instanceof Error ? error.name : "unknown",
    });
    redirect(
      `/painel/pedidos/${orderId.data}?erro=${encodeURIComponent(
        "Não foi possível atualizar o pedido. Tente novamente.",
      )}`,
    );
  }

  if (!result.ok) {
    redirect(`/painel/pedidos/${orderId.data}?erro=${encodeURIComponent(result.message)}`);
  }

  revalidatePath("/painel/pedidos");
  revalidatePath(`/painel/pedidos/${orderId.data}`);

  redirect(`/painel/pedidos/${orderId.data}?ok=1`);
}
