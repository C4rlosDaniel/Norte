"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { getDb } from "@/server/db/client";
import { log } from "@/server/logger";
import { createOrder } from "@/server/orders/create-order";
import { checkoutInputSchema } from "@/server/orders/schema";
import { getRestaurantBySlug } from "@/server/restaurant/queries";

export type CheckoutActionState =
  | { status: "idle" }
  | { status: "success"; orderCode: string; orderNumber: number }
  | {
      status: "error";
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

function invalid(error: z.ZodError): CheckoutActionState {
  return {
    status: "error",
    message: "Revise os campos destacados para finalizar o pedido.",
    fieldErrors: z.flattenError(error).fieldErrors,
  };
}

export async function createOrderAction(
  _previous: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState> {
  const slug = text(formData, "slug").trim();
  if (!slug) {
    return { status: "error", message: "Cardápio não identificado. Volte ao início." };
  }

  let cartItems: unknown;
  try {
    cartItems = JSON.parse(text(formData, "cart"));
  } catch {
    return { status: "error", message: "Não foi possível ler o carrinho. Recarregue a página." };
  }

  const parsed = checkoutInputSchema.safeParse({
    items: cartItems,
    type: text(formData, "type"),
    customerName: text(formData, "customerName"),
    customerPhone: text(formData, "customerPhone"),
    addressStreet: text(formData, "addressStreet"),
    addressNumber: text(formData, "addressNumber"),
    addressComplement: text(formData, "addressComplement"),
    addressDistrict: text(formData, "addressDistrict"),
    addressReference: text(formData, "addressReference"),
    paymentMethod: text(formData, "paymentMethod"),
    changeFor: text(formData, "changeFor"),
    notes: text(formData, "notes"),
    idempotencyKey: text(formData, "idempotencyKey"),
  });

  if (!parsed.success) return invalid(parsed.error);

  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for") ?? "";
  const clientKey =
    forwarded.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "local";

  try {
    const db = getDb();
    const restaurant = await getRestaurantBySlug(db, slug);

    if (!restaurant) {
      return { status: "error", message: "Restaurante não encontrado. Volte ao cardápio." };
    }

    const result = await createOrder(db, restaurant.id, parsed.data, {
      clientKey: clientKey.slice(0, 64),
    });

    if (!result.ok) {
      return { status: "error", message: result.message };
    }

    revalidatePath("/painel/pedidos");

    return {
      status: "success",
      orderCode: result.linkCode,
      orderNumber: result.orderNumber,
    };
  } catch (error) {
    log("error", "order_create_failed", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return {
      status: "error",
      message: "Não foi possível enviar o pedido agora. Tente novamente em instantes.",
    };
  }
}
