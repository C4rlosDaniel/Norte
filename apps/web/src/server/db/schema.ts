import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { PrintJobPayload, WhatsAppTaskPayload } from "@/server/orders/types";

export const userRole = pgEnum("user_role", ["owner", "staff"]);

export const orderStatus = pgEnum("order_status", [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "canceled",
]);

export const orderType = pgEnum("order_type", ["delivery", "pickup"]);

export const paymentMethod = pgEnum("payment_method", ["cash", "card", "pix"]);

export const printJobStatus = pgEnum("print_job_status", [
  "pending",
  "processing",
  "printed",
  "failed",
  "canceled",
]);

export const whatsappTaskKind = pgEnum("whatsapp_task_kind", ["order_confirmation"]);

export const whatsappTaskStatus = pgEnum("whatsapp_task_status", [
  "pending",
  "sent",
  "failed",
  "skipped",
]);

export const restaurants = pgTable(
  "restaurants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    timezone: text("timezone").notNull().default("America/Sao_Paulo"),
    lastOrderNumber: integer("last_order_number").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("restaurants_slug_key").on(table.slug)],
);

/**
 * Vínculo entre usuário do Supabase Auth e restaurante.
 * Não há FK para auth.users: esse schema pertence ao Supabase e não existe no banco de testes.
 */
export const restaurantUsers = pgTable(
  "restaurant_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    role: userRole("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("restaurant_users_user_id_key").on(table.userId),
    index("restaurant_users_restaurant_id_idx").on(table.restaurantId),
  ],
);

export const restaurantSettings = pgTable(
  "restaurant_settings",
  {
    restaurantId: uuid("restaurant_id")
      .primaryKey()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    phone: text("phone").notNull().default(""),
    addressLine: text("address_line").notNull().default(""),
    deliveryFeeCents: integer("delivery_fee_cents").notNull().default(0),
    minOrderCents: integer("min_order_cents").notNull().default(0),
    deliveryEnabled: boolean("delivery_enabled").notNull().default(true),
    isManuallyClosed: boolean("is_manually_closed").notNull().default(false),
    closedMessage: text("closed_message").notNull().default(""),
    paymentMethods: text("payment_methods")
      .array()
      .notNull()
      .default(sql`ARRAY['cash', 'card', 'pix']::text[]`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("restaurant_settings_delivery_fee_non_negative", sql`${table.deliveryFeeCents} >= 0`),
    check("restaurant_settings_min_order_non_negative", sql`${table.minOrderCents} >= 0`),
  ],
);

export const businessHours = pgTable(
  "business_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    /** 0 = domingo ... 6 = sábado */
    weekday: smallint("weekday").notNull(),
    opensAt: time("opens_at").notNull(),
    closesAt: time("closes_at").notNull(),
    acceptsDeliveryUntil: time("accepts_delivery_until"),
    isClosed: boolean("is_closed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("business_hours_restaurant_weekday_opens_key").on(
      table.restaurantId,
      table.weekday,
      table.opensAt,
    ),
    check("business_hours_weekday_range", sql`${table.weekday} >= 0 AND ${table.weekday} <= 6`),
  ],
);

export const menuCategories = pgTable(
  "menu_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("menu_categories_restaurant_name_key").on(table.restaurantId, table.name),
    index("menu_categories_restaurant_sort_idx").on(table.restaurantId, table.sortOrder),
    check("menu_categories_sort_order_non_negative", sql`${table.sortOrder} >= 0`),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => menuCategories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    priceCents: integer("price_cents").notNull(),
    imageUrl: text("image_url"),
    servesLabel: text("serves_label").notNull().default(""),
    /** Selo curto exibido no cardápio ("Raiz", "Mais pedido", ...). */
    badge: text("badge").notNull().default(""),
    /** Filtros do cardápio: serve1, dividir, carnesol, peixes. */
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    isAvailable: boolean("is_available").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("products_restaurant_category_sort_idx").on(
      table.restaurantId,
      table.categoryId,
      table.sortOrder,
    ),
    check("products_price_cents_non_negative", sql`${table.priceCents} >= 0`),
    check("products_sort_order_non_negative", sql`${table.sortOrder} >= 0`),
  ],
);

/**
 * Grupos de adicionais pertencem ao produto (não são compartilhados entre
 * produtos). `min_selections > 0` significa escolha obrigatória.
 */
export const modifierGroups = pgTable(
  "modifier_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    minSelections: integer("min_selections").notNull().default(0),
    maxSelections: integer("max_selections").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("modifier_groups_product_sort_idx").on(table.productId, table.sortOrder),
    check("modifier_groups_min_non_negative", sql`${table.minSelections} >= 0`),
    check("modifier_groups_max_positive", sql`${table.maxSelections} >= 1`),
    check("modifier_groups_max_gte_min", sql`${table.maxSelections} >= ${table.minSelections}`),
    check("modifier_groups_sort_order_non_negative", sql`${table.sortOrder} >= 0`),
  ],
);

export const modifierOptions = pgTable(
  "modifier_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => modifierGroups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull().default(0),
    isAvailable: boolean("is_available").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("modifier_options_group_sort_idx").on(table.groupId, table.sortOrder),
    check("modifier_options_price_cents_non_negative", sql`${table.priceCents} >= 0`),
    check("modifier_options_sort_order_non_negative", sql`${table.sortOrder} >= 0`),
  ],
);

/**
 * Contador de requisições por janela. Fica no banco porque serverless
 * não tem memória compartilhada e não queremos um serviço extra nesta fase.
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    bucket: text("bucket").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.bucket, table.windowStart], name: "rate_limits_pk" })],
);

/**
 * Pedido com snapshot completo de itens e adicionais. Nada aqui é recalculado
 * depois: mudar o cardápio não altera pedidos antigos.
 */
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    /** Sequencial por restaurante, nunca reaproveitado. */
    orderNumber: integer("order_number").notNull(),
    /** Código público do acompanhamento (URL não adivinhável). */
    linkCode: text("link_code").notNull(),
    /** Chave do cliente para impedir pedido duplicado em retry. */
    idempotencyKey: uuid("idempotency_key").notNull(),
    status: orderStatus("status").notNull().default("pending"),
    type: orderType("type").notNull(),
    customerName: text("customer_name").notNull(),
    /** Só dígitos: DDD + número (10 ou 11). */
    customerPhone: text("customer_phone").notNull(),
    addressStreet: text("address_street").notNull().default(""),
    addressNumber: text("address_number").notNull().default(""),
    addressComplement: text("address_complement").notNull().default(""),
    addressDistrict: text("address_district").notNull().default(""),
    addressReference: text("address_reference").notNull().default(""),
    notes: text("notes").notNull().default(""),
    subtotalCents: integer("subtotal_cents").notNull(),
    deliveryFeeCents: integer("delivery_fee_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    paymentMethod: paymentMethod("payment_method").notNull(),
    /** Troco para quanto (somente dinheiro); null = sem troco. */
    changeForCents: integer("change_for_cents"),
    cancelReason: text("cancel_reason").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("orders_restaurant_number_key").on(table.restaurantId, table.orderNumber),
    uniqueIndex("orders_restaurant_idempotency_key").on(
      table.restaurantId,
      table.idempotencyKey,
    ),
    uniqueIndex("orders_link_code_key").on(table.linkCode),
    index("orders_restaurant_created_idx").on(table.restaurantId, table.createdAt),
    index("orders_restaurant_status_created_idx").on(
      table.restaurantId,
      table.status,
      table.createdAt,
    ),
    check("orders_number_positive", sql`${table.orderNumber} > 0`),
    check("orders_subtotal_non_negative", sql`${table.subtotalCents} >= 0`),
    check("orders_delivery_fee_non_negative", sql`${table.deliveryFeeCents} >= 0`),
    check("orders_total_non_negative", sql`${table.totalCents} >= 0`),
    check(
      "orders_total_matches",
      sql`${table.totalCents} = ${table.subtotalCents} + ${table.deliveryFeeCents}`,
    ),
    check(
      "orders_change_for_covers_total",
      sql`${table.changeForCents} IS NULL OR ${table.changeForCents} >= ${table.totalCents}`,
    ),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** Referência fraca: o snapshot sobrevive à exclusão do produto. */
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    productName: text("product_name").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
    modifiersTotalCents: integer("modifiers_total_cents").notNull().default(0),
    lineTotalCents: integer("line_total_cents").notNull(),
    notes: text("notes").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("order_items_order_sort_idx").on(table.orderId, table.sortOrder),
    check("order_items_quantity_positive", sql`${table.quantity} > 0`),
    check("order_items_unit_price_non_negative", sql`${table.unitPriceCents} >= 0`),
    check("order_items_modifiers_total_non_negative", sql`${table.modifiersTotalCents} >= 0`),
    check("order_items_line_total_non_negative", sql`${table.lineTotalCents} >= 0`),
    check(
      "order_items_line_total_matches",
      sql`${table.lineTotalCents} = (${table.unitPriceCents} + ${table.modifiersTotalCents}) * ${table.quantity}`,
    ),
  ],
);

export const orderItemModifiers = pgTable(
  "order_item_modifiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    groupName: text("group_name").notNull(),
    optionName: text("option_name").notNull(),
    priceCents: integer("price_cents").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("order_item_modifiers_item_sort_idx").on(table.orderItemId, table.sortOrder),
    check("order_item_modifiers_price_non_negative", sql`${table.priceCents} >= 0`),
  ],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: orderStatus("status").notNull(),
    note: text("note").notNull().default(""),
    /** Usuário do Supabase Auth que executou a mudança (null = sistema/cliente). */
    actorUserId: uuid("actor_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("order_events_order_created_idx").on(table.orderId, table.createdAt)],
);

/** Trabalho de impressão criado na MESMA transação do pedido (consumido na Fase 4). */
export const printJobs = pgTable(
  "print_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: printJobStatus("status").notNull().default("pending"),
    payload: jsonb("payload").$type<PrintJobPayload>().notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error").notNull().default(""),
    leasedBy: text("leased_by"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    printedAt: timestamp("printed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("print_jobs_restaurant_status_created_idx").on(
      table.restaurantId,
      table.status,
      table.createdAt,
    ),
    index("print_jobs_order_idx").on(table.orderId),
    check("print_jobs_attempts_non_negative", sql`${table.attempts} >= 0`),
  ],
);

/** Tarefa de WhatsApp criada na MESMA transação do pedido (consumida na Fase 5). */
export const whatsappTasks = pgTable(
  "whatsapp_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    kind: whatsappTaskKind("kind").notNull(),
    status: whatsappTaskStatus("status").notNull().default("pending"),
    payload: jsonb("payload").$type<WhatsAppTaskPayload>().notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error").notNull().default(""),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("whatsapp_tasks_restaurant_status_scheduled_idx").on(
      table.restaurantId,
      table.status,
      table.scheduledFor,
    ),
    index("whatsapp_tasks_order_idx").on(table.orderId),
    check("whatsapp_tasks_attempts_non_negative", sql`${table.attempts} >= 0`),
  ],
);

export type Restaurant = typeof restaurants.$inferSelect;
export type RestaurantUser = typeof restaurantUsers.$inferSelect;
export type RestaurantSettings = typeof restaurantSettings.$inferSelect;
export type BusinessHour = typeof businessHours.$inferSelect;
export type MenuCategory = typeof menuCategories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ModifierGroup = typeof modifierGroups.$inferSelect;
export type ModifierOption = typeof modifierOptions.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderItemModifier = typeof orderItemModifiers.$inferSelect;
export type OrderEvent = typeof orderEvents.$inferSelect;
export type PrintJob = typeof printJobs.$inferSelect;
export type WhatsAppTask = typeof whatsappTasks.$inferSelect;
export type OrderStatus = (typeof orderStatus.enumValues)[number];
export type OrderType = (typeof orderType.enumValues)[number];
export type PaymentMethod = (typeof paymentMethod.enumValues)[number];
