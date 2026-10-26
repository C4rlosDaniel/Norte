import { and, asc, count, desc, eq, inArray } from "drizzle-orm";

import type { Db } from "@/server/db/types";
import {
  orderEvents,
  orderItemModifiers,
  orderItems,
  orders,
  printJobs,
  restaurantSettings,
  restaurants,
  whatsappTasks,
  type Order,
  type OrderEvent,
  type OrderItem,
  type OrderItemModifier,
  type OrderStatus,
  type PrintJob,
  type WhatsAppTask,
} from "@/server/db/schema";

export type OrderItemWithModifiers = OrderItem & { modifiers: OrderItemModifier[] };

export type OrderDetail = {
  order: Order;
  items: OrderItemWithModifiers[];
  events: OrderEvent[];
  printJobs: PrintJob[];
  whatsappTasks: WhatsAppTask[];
};

export type PublicOrderDetail = {
  order: Order;
  items: OrderItemWithModifiers[];
  events: OrderEvent[];
  restaurant: {
    name: string;
    phone: string;
    addressLine: string;
    slug: string;
    timezone: string;
  };
};

async function loadItems(
  db: Db,
  orderId: string,
): Promise<OrderItemWithModifiers[]> {
  const itemRows = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(asc(orderItems.sortOrder));

  if (itemRows.length === 0) return [];

  const modifierRows = await db
    .select()
    .from(orderItemModifiers)
    .where(
      inArray(
        orderItemModifiers.orderItemId,
        itemRows.map((item) => item.id),
      ),
    )
    .orderBy(asc(orderItemModifiers.sortOrder));

  const byItem = new Map<string, OrderItemModifier[]>();
  for (const modifier of modifierRows) {
    const current = byItem.get(modifier.orderItemId) ?? [];
    current.push(modifier);
    byItem.set(modifier.orderItemId, current);
  }

  return itemRows.map((item) => ({
    ...item,
    modifiers: byItem.get(item.id) ?? [],
  }));
}

export async function listOrdersForPanel(
  db: Db,
  restaurantId: string,
  options: { statuses?: OrderStatus[]; limit?: number } = {},
): Promise<Order[]> {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 200);
  const conditions = [eq(orders.restaurantId, restaurantId)];

  if (options.statuses && options.statuses.length > 0) {
    conditions.push(inArray(orders.status, options.statuses));
  }

  return db
    .select()
    .from(orders)
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}

export async function countOrdersByStatus(
  db: Db,
  restaurantId: string,
): Promise<Record<OrderStatus, number>> {
  const rows = await db
    .select({ status: orders.status, total: count() })
    .from(orders)
    .where(eq(orders.restaurantId, restaurantId))
    .groupBy(orders.status);

  const counts = {
    pending: 0,
    confirmed: 0,
    preparing: 0,
    ready: 0,
    out_for_delivery: 0,
    delivered: 0,
    canceled: 0,
  } satisfies Record<OrderStatus, number>;

  for (const row of rows) counts[row.status] = Number(row.total);

  return counts;
}

export async function getOrderForPanel(
  db: Db,
  restaurantId: string,
  orderId: string,
): Promise<OrderDetail | null> {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.restaurantId, restaurantId)))
    .limit(1);

  if (!order) return null;

  const [items, events, jobs, tasks] = await Promise.all([
    loadItems(db, order.id),
    db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, order.id))
      .orderBy(asc(orderEvents.createdAt)),
    db
      .select()
      .from(printJobs)
      .where(eq(printJobs.orderId, order.id))
      .orderBy(desc(printJobs.createdAt)),
    db
      .select()
      .from(whatsappTasks)
      .where(eq(whatsappTasks.orderId, order.id))
      .orderBy(desc(whatsappTasks.createdAt)),
  ]);

  return { order, items, events, printJobs: jobs, whatsappTasks: tasks };
}

/** Link público: o código aleatório é o segredo. Não exige sessão. */
export async function getOrderByLinkCode(
  db: Db,
  linkCode: string,
): Promise<PublicOrderDetail | null> {
  if (!/^[0-9a-f]{16}$/.test(linkCode)) return null;

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.linkCode, linkCode))
    .limit(1);

  if (!order) return null;

  const [items, events, restaurantRow] = await Promise.all([
    loadItems(db, order.id),
    db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, order.id))
      .orderBy(asc(orderEvents.createdAt)),
    db
      .select({
        name: restaurants.name,
        phone: restaurantSettings.phone,
        addressLine: restaurantSettings.addressLine,
        slug: restaurants.slug,
        timezone: restaurants.timezone,
      })
      .from(restaurants)
      .leftJoin(
        restaurantSettings,
        eq(restaurantSettings.restaurantId, restaurants.id),
      )
      .where(eq(restaurants.id, order.restaurantId))
      .limit(1),
  ]);

  const restaurant = restaurantRow[0];
  if (!restaurant) return null;

  return {
    order,
    items,
    events,
    restaurant: {
      name: restaurant.name,
      phone: restaurant.phone ?? "",
      addressLine: restaurant.addressLine ?? "",
      slug: restaurant.slug,
      timezone: restaurant.timezone,
    },
  };
}
