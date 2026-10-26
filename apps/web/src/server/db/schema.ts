import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
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

export const userRole = pgEnum("user_role", ["owner", "staff"]);

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

export type Restaurant = typeof restaurants.$inferSelect;
export type RestaurantUser = typeof restaurantUsers.$inferSelect;
export type RestaurantSettings = typeof restaurantSettings.$inferSelect;
export type BusinessHour = typeof businessHours.$inferSelect;
export type MenuCategory = typeof menuCategories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ModifierGroup = typeof modifierGroups.$inferSelect;
export type ModifierOption = typeof modifierOptions.$inferSelect;
