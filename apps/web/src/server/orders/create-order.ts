import { createHash, randomBytes } from "node:crypto";

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import type { Db } from "@/server/db/types";
import {
  menuCategories,
  modifierGroups,
  modifierOptions,
  orderEvents,
  orderItemModifiers,
  orderItems,
  orders,
  printJobs,
  products,
  restaurants,
  whatsappTasks,
  type ModifierGroup,
  type ModifierOption,
} from "@/server/db/schema";
import { formatBRL } from "@/server/money";
import { evaluateOpenState } from "@/server/restaurant/business-hours";
import { getRestaurantSnapshot } from "@/server/restaurant/queries";
import { consumeRateLimit } from "@/server/orders/rate-limit";
import { formatAddress, formatPhone, type CheckoutInput } from "@/server/orders/schema";
import { paymentMethodLabel } from "@/server/orders/status";
import type {
  OrderTypeValue,
  PrintJobItem,
  PrintJobModifier,
  PrintJobPayload,
  WhatsAppTaskPayload,
} from "@/server/orders/types";

export type CreateOrderFailureReason =
  | "restaurant_not_found"
  | "closed"
  | "delivery_unavailable"
  | "payment_unavailable"
  | "invalid_item"
  | "invalid_modifiers"
  | "min_order"
  | "invalid_change"
  | "rate_limited";

export type CreateOrderResult =
  | { ok: true; orderId: string; orderNumber: number; linkCode: string }
  | { ok: false; reason: CreateOrderFailureReason; message: string };

type CreateOrderOptions = {
  /** Identificador do solicitante (IP) só para rate limit; não é persistido no pedido. */
  clientKey: string;
  now?: Date;
};

type ResolvedItem = {
  productId: string;
  productName: string;
  unitPriceCents: number;
  quantity: number;
  notes: string;
  modifiersTotalCents: number;
  lineTotalCents: number;
  modifiers: PrintJobModifier[];
};

function failure(reason: CreateOrderFailureReason, message: string): CreateOrderResult {
  return { ok: false, reason, message };
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  if (code === "23505" || code === 23505) return true;
  return error instanceof Error && /duplicate key|unique constraint/i.test(error.message);
}

function hashPhone(phone: string): string {
  return createHash("sha256").update(phone).digest("hex").slice(0, 32);
}

function resolveItems(
  input: CheckoutInput,
  productRows: Array<{ product: typeof products.$inferSelect; categoryActive: boolean }>,
  groupsByProduct: Map<string, Array<{ group: ModifierGroup; options: ModifierOption[] }>>,
): ResolvedItem[] | CreateOrderResult {
  const productById = new Map(productRows.map((row) => [row.product.id, row]));

  const optionById = new Map<string, { option: ModifierOption; group: ModifierGroup }>();
  for (const groups of groupsByProduct.values()) {
    for (const { group, options } of groups) {
      for (const option of options) {
        optionById.set(option.id, { option, group });
      }
    }
  }

  const resolved: ResolvedItem[] = [];

  for (const item of input.items) {
    const row = productById.get(item.productId);
    if (!row) {
      return failure("invalid_item", "Um item do carrinho saiu do cardápio. Revise o pedido.");
    }

    if (!row.categoryActive) {
      return failure(
        "invalid_item",
        `A categoria de ${row.product.name} não está mais disponível. Revise o pedido.`,
      );
    }

    if (!row.product.isAvailable) {
      return failure(
        "invalid_item",
        `${row.product.name} está indisponível agora. Remova o item para continuar.`,
      );
    }

    const groups = groupsByProduct.get(item.productId) ?? [];
    const productGroupIds = new Set(groups.map(({ group }) => group.id));
    const selectedByGroup = new Map<string, ModifierOption[]>();

    for (const optionId of item.optionIds) {
      const found = optionById.get(optionId);
      if (!found || !productGroupIds.has(found.group.id)) {
        return failure("invalid_modifiers", "Um adicional não pertence a este item. Revise o pedido.");
      }
      if (!found.option.isAvailable) {
        return failure(
          "invalid_modifiers",
          `O adicional ${found.option.name} está indisponível. Revise o pedido.`,
        );
      }

      const current = selectedByGroup.get(found.group.id) ?? [];
      if (current.some((option) => option.id === optionId)) {
        return failure("invalid_modifiers", "Adicional repetido no mesmo item. Revise o pedido.");
      }
      current.push(found.option);
      selectedByGroup.set(found.group.id, current);
    }

    const modifiers: PrintJobModifier[] = [];

    for (const { group } of groups) {
      const selected = selectedByGroup.get(group.id) ?? [];

      if (selected.length < group.minSelections) {
        return failure(
          "invalid_modifiers",
          `Escolha ${group.minSelections} opção(ões) em "${group.name}" para ${row.product.name}.`,
        );
      }

      if (selected.length > group.maxSelections) {
        return failure(
          "invalid_modifiers",
          `Escolha no máximo ${group.maxSelections} opção(ões) em "${group.name}".`,
        );
      }

      for (const option of selected) {
        modifiers.push({
          group: group.name,
          option: option.name,
          priceCents: option.priceCents,
        });
      }
    }

    const modifiersTotalCents = modifiers.reduce((total, mod) => total + mod.priceCents, 0);
    const lineTotalCents = (row.product.priceCents + modifiersTotalCents) * item.quantity;

    resolved.push({
      productId: row.product.id,
      productName: row.product.name,
      unitPriceCents: row.product.priceCents,
      quantity: item.quantity,
      notes: item.notes,
      modifiersTotalCents,
      lineTotalCents,
      modifiers,
    });
  }

  return resolved;
}

/**
 * Cria o pedido recalculando TUDO a partir do banco. O cliente só manda ids,
 * quantidades, opções e dados de contato — nenhum preço é confiado.
 *
 * Pedido, itens, histórico, impressão e WhatsApp nascem na mesma transação.
 * `idempotencyKey` impede duplicação em retry de rede ou duplo clique.
 */
export async function createOrder(
  db: Db,
  restaurantId: string,
  input: CheckoutInput,
  { clientKey, now = new Date() }: CreateOrderOptions,
): Promise<CreateOrderResult> {
  const [existing] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      linkCode: orders.linkCode,
    })
    .from(orders)
    .where(
      and(
        eq(orders.restaurantId, restaurantId),
        eq(orders.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);

  if (existing) {
    return {
      ok: true,
      orderId: existing.id,
      orderNumber: existing.orderNumber,
      linkCode: existing.linkCode,
    };
  }

  const snapshot = await getRestaurantSnapshot(db, restaurantId);
  if (!snapshot) {
    return failure("restaurant_not_found", "Restaurante não configurado. Fale com a equipe.");
  }

  const { settings, hours } = snapshot;
  const openState = evaluateOpenState({
    hours,
    now,
    timeZone: snapshot.restaurant.timezone,
    manuallyClosed: settings.isManuallyClosed,
    deliveryEnabled: settings.deliveryEnabled,
  });

  if (!openState.isOpen) {
    return failure(
      "closed",
      settings.isManuallyClosed
        ? settings.closedMessage || "O restaurante está fechado agora."
        : "O restaurante está fora do horário de atendimento.",
    );
  }

  if (input.type === "delivery" && !settings.deliveryEnabled) {
    return failure(
      "delivery_unavailable",
      "A entrega está desativada. Escolha retirada no restaurante.",
    );
  }

  if (input.type === "delivery" && !openState.deliveryAllowed) {
    return failure(
      "delivery_unavailable",
      "A entrega não está disponível neste horário. Escolha retirada.",
    );
  }

  if (!settings.paymentMethods.includes(input.paymentMethod)) {
    return failure("payment_unavailable", "Forma de pagamento indisponível no momento.");
  }

  const ipLimit = await consumeRateLimit(db, {
    bucket: `order-ip:${restaurantId}:${clientKey}`,
    limit: 10,
    windowSeconds: 600,
    now,
  });
  if (!ipLimit.allowed) {
    return failure(
      "rate_limited",
      "Muitos pedidos em pouco tempo. Aguarde alguns minutos e tente novamente.",
    );
  }

  const phoneLimit = await consumeRateLimit(db, {
    bucket: `order-phone:${restaurantId}:${hashPhone(input.customerPhone)}`,
    limit: 10,
    windowSeconds: 3600,
    now,
  });
  if (!phoneLimit.allowed) {
    return failure(
      "rate_limited",
      "Muitos pedidos para este telefone. Aguarde e tente novamente.",
    );
  }

  const uniqueProductIds = [...new Set(input.items.map((item) => item.productId))];

  const productRows = await db
    .select({
      product: products,
      categoryActive: menuCategories.isActive,
    })
    .from(products)
    .innerJoin(menuCategories, eq(menuCategories.id, products.categoryId))
    .where(
      and(
        eq(products.restaurantId, restaurantId),
        eq(menuCategories.restaurantId, restaurantId),
        inArray(products.id, uniqueProductIds),
      ),
    );

  const groupRows = await db
    .select()
    .from(modifierGroups)
    .where(inArray(modifierGroups.productId, uniqueProductIds))
    .orderBy(asc(modifierGroups.sortOrder), asc(modifierGroups.name));

  const groupIds = groupRows.map((group) => group.id);
  const optionRows =
    groupIds.length > 0
      ? await db
          .select()
          .from(modifierOptions)
          .where(inArray(modifierOptions.groupId, groupIds))
          .orderBy(asc(modifierOptions.sortOrder), asc(modifierOptions.name))
      : [];

  const optionsByGroup = new Map<string, ModifierOption[]>();
  for (const option of optionRows) {
    const current = optionsByGroup.get(option.groupId) ?? [];
    current.push(option);
    optionsByGroup.set(option.groupId, current);
  }

  const groupsByProduct = new Map<string, Array<{ group: ModifierGroup; options: ModifierOption[] }>>();
  for (const group of groupRows) {
    const current = groupsByProduct.get(group.productId) ?? [];
    current.push({ group, options: optionsByGroup.get(group.id) ?? [] });
    groupsByProduct.set(group.productId, current);
  }

  const items = resolveItems(input, productRows, groupsByProduct);
  if (!Array.isArray(items)) return items;

  const subtotalCents = items.reduce((total, item) => total + item.lineTotalCents, 0);

  if (settings.minOrderCents > 0 && subtotalCents < settings.minOrderCents) {
    return failure(
      "min_order",
      `O pedido mínimo é ${formatBRL(settings.minOrderCents)}. Adicione mais itens.`,
    );
  }

  const deliveryFeeCents =
    input.type === "delivery" ? settings.deliveryFeeCents : 0;
  const totalCents = subtotalCents + deliveryFeeCents;

  let changeForCents: number | null = null;
  if (input.paymentMethod === "cash" && input.changeFor !== null) {
    if (input.changeFor < totalCents) {
      return failure(
        "invalid_change",
        `O troco deve ser para um valor maior ou igual ao total (${formatBRL(totalCents)}).`,
      );
    }
    changeForCents = input.changeFor;
  }

  const address =
    input.type === "delivery"
      ? formatAddress(input)
      : null;

  const type: OrderTypeValue = input.type;

  try {
    const created = await db.transaction(async (tx) => {
      const [counter] = await tx
        .update(restaurants)
        .set({ lastOrderNumber: sql`${restaurants.lastOrderNumber} + 1`, updatedAt: now })
        .where(eq(restaurants.id, restaurantId))
        .returning({ orderNumber: restaurants.lastOrderNumber });

      if (!counter) throw new Error("restaurante desapareceu durante o checkout");

      const linkCode = randomBytes(8).toString("hex");

      const [order] = await tx
        .insert(orders)
        .values({
          restaurantId,
          orderNumber: counter.orderNumber,
          linkCode,
          idempotencyKey: input.idempotencyKey,
          status: "pending",
          type: input.type,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          addressStreet: input.type === "delivery" ? input.addressStreet : "",
          addressNumber: input.type === "delivery" ? input.addressNumber : "",
          addressComplement: input.type === "delivery" ? input.addressComplement : "",
          addressDistrict: input.type === "delivery" ? input.addressDistrict : "",
          addressReference: input.type === "delivery" ? input.addressReference : "",
          notes: input.notes,
          subtotalCents,
          deliveryFeeCents,
          totalCents,
          paymentMethod: input.paymentMethod,
          changeForCents,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: orders.id });

      if (!order) throw new Error("pedido não inserido");

      const payloadItems: PrintJobItem[] = [];

      for (const [index, item] of items.entries()) {
        const [itemRow] = await tx
          .insert(orderItems)
          .values({
            orderId: order.id,
            productId: item.productId,
            productName: item.productName,
            unitPriceCents: item.unitPriceCents,
            quantity: item.quantity,
            modifiersTotalCents: item.modifiersTotalCents,
            lineTotalCents: item.lineTotalCents,
            notes: item.notes,
            sortOrder: index,
            createdAt: now,
          })
          .returning({ id: orderItems.id });

        if (!itemRow) throw new Error("item do pedido não inserido");

        if (item.modifiers.length > 0) {
          await tx.insert(orderItemModifiers).values(
            item.modifiers.map((modifier, modifierIndex) => ({
              orderItemId: itemRow.id,
              groupName: modifier.group,
              optionName: modifier.option,
              priceCents: modifier.priceCents,
              sortOrder: modifierIndex,
            })),
          );
        }

        payloadItems.push({
          productName: item.productName,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          modifiers: item.modifiers,
          modifiersTotalCents: item.modifiersTotalCents,
          lineTotalCents: item.lineTotalCents,
          notes: item.notes,
        });
      }

      await tx.insert(orderEvents).values({
        orderId: order.id,
        status: "pending",
        note: "Pedido recebido pelo site.",
        createdAt: now,
      });

      const printPayload: PrintJobPayload = {
        version: 1,
        orderNumber: counter.orderNumber,
        linkCode,
        createdAt: now.toISOString(),
        restaurant: {
          name: snapshot.restaurant.name,
          phone: settings.phone,
          addressLine: settings.addressLine,
        },
        type,
        customer: {
          name: input.customerName,
          phone: formatPhone(input.customerPhone),
        },
        address,
        items: payloadItems,
        subtotalCents,
        deliveryFeeCents,
        totalCents,
        payment: {
          method: input.paymentMethod,
          label: paymentMethodLabel(input.paymentMethod),
          changeForCents,
        },
        notes: input.notes,
      };

      await tx.insert(printJobs).values({
        restaurantId,
        orderId: order.id,
        status: "pending",
        payload: printPayload,
        createdAt: now,
        updatedAt: now,
      });

      const whatsappPayload: WhatsAppTaskPayload = {
        phone: input.customerPhone,
        customerName: input.customerName,
        orderNumber: counter.orderNumber,
        linkCode,
        totalCents,
        type,
      };

      await tx.insert(whatsappTasks).values({
        restaurantId,
        orderId: order.id,
        kind: "order_confirmation",
        status: "pending",
        payload: whatsappPayload,
        scheduledFor: now,
        createdAt: now,
        updatedAt: now,
      });

      return {
        ok: true as const,
        orderId: order.id,
        orderNumber: counter.orderNumber,
        linkCode,
      };
    });

    return created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      const [existingOrder] = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          linkCode: orders.linkCode,
        })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, restaurantId),
            eq(orders.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);

      if (existingOrder) {
        return {
          ok: true,
          orderId: existingOrder.id,
          orderNumber: existingOrder.orderNumber,
          linkCode: existingOrder.linkCode,
        };
      }
    }

    throw error;
  }
}
