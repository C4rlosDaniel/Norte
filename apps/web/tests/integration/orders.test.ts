import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "@/server/db/types";
import {
  businessHours,
  menuCategories,
  modifierGroups,
  modifierOptions,
  orderEvents,
  orderItemModifiers,
  orderItems,
  orders,
  printJobs,
  products,
  restaurantSettings,
  restaurants,
  whatsappTasks,
} from "@/server/db/schema";
import { createOrder } from "@/server/orders/create-order";
import { updateOrderStatus } from "@/server/orders/mutations";
import {
  countOrdersByStatus,
  getOrderByLinkCode,
  getOrderForPanel,
  listOrdersForPanel,
} from "@/server/orders/queries";
import { checkoutInputSchema } from "@/server/orders/schema";
import { createTestDatabase, type TestDatabase } from "./helpers/database";

type Fixture = {
  restaurantId: string;
  picanhaId: string;
  drinkId: string;
  unavailableId: string;
  categoryId: string;
  pontoId: string;
  aoPontoId: string;
  bemPassadoId: string;
  ovoId: string;
  queijoId: string;
};

type RawInput = {
  items: Array<{ productId: string; quantity: number; optionIds: string[]; notes: string }>;
  type: "delivery" | "pickup";
  customerName: string;
  customerPhone: string;
  addressStreet: string;
  addressNumber: string;
  addressComplement: string;
  addressDistrict: string;
  addressReference: string;
  paymentMethod: "cash" | "card" | "pix";
  changeFor: string;
  notes: string;
  idempotencyKey: string;
};

let ctx: TestDatabase;

beforeEach(async () => {
  ctx = await createTestDatabase();
});

afterEach(async () => {
  await ctx.client.close();
});

async function seedRestaurant(db: Db): Promise<Fixture> {
  const [restaurant] = await db
    .insert(restaurants)
    .values({ slug: "teste", name: "Norte Teste", timezone: "America/Sao_Paulo" })
    .returning();

  if (!restaurant) throw new Error("restaurante não criado");

  await db.insert(restaurantSettings).values({
    restaurantId: restaurant.id,
    phone: "(11) 99999-9999",
    addressLine: "Rua A, 1 — Centro",
    deliveryFeeCents: 500,
    minOrderCents: 0,
    deliveryEnabled: true,
    isManuallyClosed: false,
    closedMessage: "Fechado agora.",
    paymentMethods: ["cash", "card", "pix"],
  });

  await db.insert(businessHours).values(
    Array.from({ length: 7 }, (_, weekday) => ({
      restaurantId: restaurant.id,
      weekday,
      opensAt: "00:00:00",
      closesAt: "23:59:59",
      acceptsDeliveryUntil: "23:59:59",
      isClosed: false,
    })),
  );

  const [category] = await db
    .insert(menuCategories)
    .values({ restaurantId: restaurant.id, name: "Pratos", sortOrder: 0 })
    .returning();
  if (!category) throw new Error("categoria não criada");

  const [picanha] = await db
    .insert(products)
    .values({
      restaurantId: restaurant.id,
      categoryId: category.id,
      name: "Picanha",
      priceCents: 4990,
      sortOrder: 0,
    })
    .returning();
  const [drink] = await db
    .insert(products)
    .values({
      restaurantId: restaurant.id,
      categoryId: category.id,
      name: "Refrigerante",
      priceCents: 600,
      sortOrder: 1,
    })
    .returning();
  const [unavailable] = await db
    .insert(products)
    .values({
      restaurantId: restaurant.id,
      categoryId: category.id,
      name: "Esgotado",
      priceCents: 1000,
      isAvailable: false,
      sortOrder: 2,
    })
    .returning();

  if (!picanha || !drink || !unavailable) throw new Error("produtos não criados");

  const [ponto] = await db
    .insert(modifierGroups)
    .values({
      productId: picanha.id,
      name: "Ponto",
      minSelections: 1,
      maxSelections: 1,
      sortOrder: 0,
    })
    .returning();
  const [extras] = await db
    .insert(modifierGroups)
    .values({
      productId: picanha.id,
      name: "Adicionais",
      minSelections: 0,
      maxSelections: 2,
      sortOrder: 1,
    })
    .returning();

  if (!ponto || !extras) throw new Error("grupos não criados");

  const [aoPonto] = await db
    .insert(modifierOptions)
    .values({ groupId: ponto.id, name: "Ao ponto", priceCents: 0, sortOrder: 0 })
    .returning();
  const [bemPassado] = await db
    .insert(modifierOptions)
    .values({ groupId: ponto.id, name: "Bem passado", priceCents: 0, sortOrder: 1 })
    .returning();
  const [ovo] = await db
    .insert(modifierOptions)
    .values({ groupId: extras.id, name: "Ovo", priceCents: 300, sortOrder: 0 })
    .returning();
  const [queijo] = await db
    .insert(modifierOptions)
    .values({ groupId: extras.id, name: "Queijo", priceCents: 500, sortOrder: 1 })
    .returning();

  if (!aoPonto || !bemPassado || !ovo || !queijo) throw new Error("opções não criadas");

  return {
    restaurantId: restaurant.id,
    picanhaId: picanha.id,
    drinkId: drink.id,
    unavailableId: unavailable.id,
    categoryId: category.id,
    pontoId: ponto.id,
    aoPontoId: aoPonto.id,
    bemPassadoId: bemPassado.id,
    ovoId: ovo.id,
    queijoId: queijo.id,
  };
}

function rawInput(fixture: Fixture, overrides: Partial<RawInput> = {}): RawInput {
  return {
    items: [{ productId: fixture.drinkId, quantity: 1, optionIds: [], notes: "" }],
    type: "pickup",
    customerName: "Maria Silva",
    customerPhone: "(11) 99999-9999",
    addressStreet: "",
    addressNumber: "",
    addressComplement: "",
    addressDistrict: "",
    addressReference: "",
    paymentMethod: "cash",
    changeFor: "",
    notes: "",
    idempotencyKey: randomUUID(),
    ...overrides,
  };
}

function parsedInput(fixture: Fixture, overrides: Partial<RawInput> = {}) {
  return checkoutInputSchema.parse(rawInput(fixture, overrides));
}

function picanhaDelivery(fixture: Fixture): RawInput {
  return rawInput(fixture, {
    type: "delivery",
    items: [
      {
        productId: fixture.picanhaId,
        quantity: 2,
        optionIds: [fixture.aoPontoId, fixture.ovoId],
        notes: "sem sal",
      },
    ],
    addressStreet: "Rua das Flores",
    addressNumber: "10",
    addressComplement: "Apto 2",
    addressDistrict: "Centro",
    addressReference: "Portão azul",
    paymentMethod: "cash",
    changeFor: "150,00",
    notes: "Tocar a campainha",
  });
}

const NOW = new Date("2026-10-26T18:00:00.000Z"); // 15:00 em America/Sao_Paulo

describe("createOrder", () => {
  it("recalcula, grava snapshot e cria impressão + WhatsApp na mesma transação", async () => {
    const fixture = await seedRestaurant(ctx.db);
    const input = parsedInput(fixture, picanhaDelivery(fixture));

    const result = await createOrder(ctx.db, fixture.restaurantId, input, {
      clientKey: "test-client",
      now: NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [order] = await ctx.db.select().from(orders).where(eq(orders.id, result.orderId));
    expect(order).toMatchObject({
      orderNumber: 1,
      status: "pending",
      type: "delivery",
      customerPhone: "11999999999",
      subtotalCents: 10_580,
      deliveryFeeCents: 500,
      totalCents: 11_080,
      paymentMethod: "cash",
      changeForCents: 15_000,
      addressDistrict: "Centro",
    });
    expect(order?.linkCode).toMatch(/^[0-9a-f]{16}$/);

    const items = await ctx.db.select().from(orderItems).where(eq(orderItems.orderId, result.orderId));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      productName: "Picanha",
      quantity: 2,
      unitPriceCents: 4990,
      modifiersTotalCents: 300,
      lineTotalCents: 10_580,
      notes: "sem sal",
    });

    const modifiers = await ctx.db
      .select()
      .from(orderItemModifiers)
      .where(eq(orderItemModifiers.orderItemId, items[0]!.id));
    expect(modifiers.map((modifier) => `${modifier.groupName}:${modifier.optionName}`)).toEqual([
      "Ponto:Ao ponto",
      "Adicionais:Ovo",
    ]);

    const [job] = await ctx.db
      .select()
      .from(printJobs)
      .where(eq(printJobs.orderId, result.orderId));
    expect(job?.status).toBe("pending");
    expect(job?.payload.items[0]?.productName).toBe("Picanha");
    expect(job?.payload.totalCents).toBe(11_080);
    expect(job?.payload.address).toContain("Rua das Flores, 10");

    const [task] = await ctx.db
      .select()
      .from(whatsappTasks)
      .where(eq(whatsappTasks.orderId, result.orderId));
    expect(task?.status).toBe("pending");
    expect(task?.kind).toBe("order_confirmation");
    expect(task?.payload).toMatchObject({
      phone: "11999999999",
      orderNumber: 1,
      totalCents: 11_080,
    });

    const events = await ctx.db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, result.orderId));
    expect(events.map((event) => event.status)).toEqual(["pending"]);

    const panel = await getOrderForPanel(ctx.db, fixture.restaurantId, result.orderId);
    expect(panel?.items[0]?.modifiers).toHaveLength(2);

    const publicDetail = await getOrderByLinkCode(ctx.db, result.linkCode);
    expect(publicDetail?.order.customerName).toBe("Maria Silva");
    expect(publicDetail?.items[0]?.productName).toBe("Picanha");
    expect(publicDetail?.restaurant.name).toBe("Norte Teste");

    expect(await getOrderByLinkCode(ctx.db, "zzzzzzzzzzzzzzzz")).toBeNull();
    expect(await getOrderByLinkCode(ctx.db, "abc")).toBeNull();
  });

  it("usa numeração sequencial e mantém o snapshot após apagar o produto", async () => {
    const fixture = await seedRestaurant(ctx.db);

    const firstInput = parsedInput(fixture, {
      items: [
        {
          productId: fixture.picanhaId,
          quantity: 1,
          optionIds: [fixture.bemPassadoId, fixture.queijoId],
          notes: "",
        },
      ],
    });
    const first = await createOrder(ctx.db, fixture.restaurantId, firstInput, {
      clientKey: "seq",
      now: NOW,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    await ctx.db.delete(products).where(eq(products.id, fixture.picanhaId));

    const secondInput = parsedInput(fixture);
    const second = await createOrder(ctx.db, fixture.restaurantId, secondInput, {
      clientKey: "seq",
      now: NOW,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    const [firstOrder] = await ctx.db.select().from(orders).where(eq(orders.id, first.orderId));
    const [secondOrder] = await ctx.db.select().from(orders).where(eq(orders.id, second.orderId));
    expect(firstOrder?.orderNumber).toBe(1);
    expect(secondOrder?.orderNumber).toBe(2);

    const detail = await getOrderForPanel(ctx.db, fixture.restaurantId, first.orderId);
    expect(detail?.items[0]?.productName).toBe("Picanha");
    expect(detail?.items[0]?.productId).toBeNull();
    expect(detail?.items[0]?.modifiers.map((modifier) => modifier.optionName)).toEqual([
      "Bem passado",
      "Queijo",
    ]);
  });

  it("devolve o mesmo pedido ao repetir a chave de idempotência", async () => {
    const fixture = await seedRestaurant(ctx.db);
    const input = parsedInput(fixture);

    const first = await createOrder(ctx.db, fixture.restaurantId, input, {
      clientKey: "idem",
      now: NOW,
    });
    const second = await createOrder(ctx.db, fixture.restaurantId, input, {
      clientKey: "idem",
      now: NOW,
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.orderId).toBe(first.orderId);
    expect(second.linkCode).toBe(first.linkCode);

    expect(await ctx.db.select().from(orders)).toHaveLength(1);
    expect(await ctx.db.select().from(printJobs)).toHaveLength(1);
    expect(await ctx.db.select().from(whatsappTasks)).toHaveLength(1);
  });

  it("recusa item, categoria, adicional e opção inválidos", async () => {
    const fixture = await seedRestaurant(ctx.db);

    const missingRequired = await createOrder(
      ctx.db,
      fixture.restaurantId,
      parsedInput(fixture, {
        items: [
          {
            productId: fixture.picanhaId,
            quantity: 1,
            optionIds: [],
            notes: "",
          },
        ],
      }),
      { clientKey: "invalid", now: NOW },
    );
    expect(missingRequired).toMatchObject({ ok: false, reason: "invalid_modifiers" });

    const unavailable = await createOrder(
      ctx.db,
      fixture.restaurantId,
      parsedInput(fixture, {
        items: [
          { productId: fixture.unavailableId, quantity: 1, optionIds: [], notes: "" },
        ],
      }),
      { clientKey: "invalid", now: NOW },
    );
    expect(unavailable).toMatchObject({ ok: false, reason: "invalid_item" });

    const wrongOption = await createOrder(
      ctx.db,
      fixture.restaurantId,
      parsedInput(fixture, {
        items: [
          { productId: fixture.drinkId, quantity: 1, optionIds: [fixture.ovoId], notes: "" },
        ],
      }),
      { clientKey: "invalid", now: NOW },
    );
    expect(wrongOption).toMatchObject({ ok: false, reason: "invalid_modifiers" });

    await ctx.db
      .update(menuCategories)
      .set({ isActive: false })
      .where(eq(menuCategories.id, fixture.categoryId));

    const inactiveCategory = await createOrder(
      ctx.db,
      fixture.restaurantId,
      parsedInput(fixture),
      { clientKey: "invalid", now: NOW },
    );
    expect(inactiveCategory).toMatchObject({ ok: false, reason: "invalid_item" });

    const [otherRestaurant] = await ctx.db
      .insert(restaurants)
      .values({ slug: "outro", name: "Outro" })
      .returning();
    if (!otherRestaurant) throw new Error("restaurante não criado");
    const [otherCategory] = await ctx.db
      .insert(menuCategories)
      .values({ restaurantId: otherRestaurant.id, name: "Pratos", sortOrder: 0 })
      .returning();
    if (!otherCategory) throw new Error("categoria não criada");
    const [otherProduct] = await ctx.db
      .insert(products)
      .values({
        restaurantId: otherRestaurant.id,
        categoryId: otherCategory.id,
        name: "De outro restaurante",
        priceCents: 1000,
      })
      .returning();
    if (!otherProduct) throw new Error("produto não criado");

    const foreignProduct = await createOrder(
      ctx.db,
      fixture.restaurantId,
      parsedInput(fixture, {
        items: [
          { productId: otherProduct.id, quantity: 1, optionIds: [], notes: "" },
        ],
      }),
      { clientKey: "invalid", now: NOW },
    );
    expect(foreignProduct).toMatchObject({ ok: false, reason: "invalid_item" });

    expect(await ctx.db.select().from(orders)).toHaveLength(0);
  });

  it("respeita horário, entrega, pagamento, pedido mínimo e troco", async () => {
    const fixture = await seedRestaurant(ctx.db);
    const delivery = parsedInput(fixture, picanhaDelivery(fixture));

    await ctx.db
      .update(restaurantSettings)
      .set({ isManuallyClosed: true })
      .where(eq(restaurantSettings.restaurantId, fixture.restaurantId));

    expect(
      await createOrder(ctx.db, fixture.restaurantId, delivery, {
        clientKey: "rules",
        now: NOW,
      }),
    ).toMatchObject({ ok: false, reason: "closed" });

    await ctx.db
      .update(restaurantSettings)
      .set({ isManuallyClosed: false, deliveryEnabled: false })
      .where(eq(restaurantSettings.restaurantId, fixture.restaurantId));

    expect(
      await createOrder(ctx.db, fixture.restaurantId, delivery, {
        clientKey: "rules",
        now: NOW,
      }),
    ).toMatchObject({ ok: false, reason: "delivery_unavailable" });

    const pickup = parsedInput(fixture);
    const pickupWithPixOnly = parsedInput(fixture);
    await ctx.db
      .update(restaurantSettings)
      .set({ deliveryEnabled: true, paymentMethods: ["pix"] })
      .where(eq(restaurantSettings.restaurantId, fixture.restaurantId));

    expect(
      await createOrder(ctx.db, fixture.restaurantId, pickup, {
        clientKey: "rules",
        now: NOW,
      }),
    ).toMatchObject({ ok: false, reason: "payment_unavailable" });

    await ctx.db
      .update(restaurantSettings)
      .set({ paymentMethods: ["cash", "card", "pix"], minOrderCents: 20_000 })
      .where(eq(restaurantSettings.restaurantId, fixture.restaurantId));

    expect(
      await createOrder(ctx.db, fixture.restaurantId, pickupWithPixOnly, {
        clientKey: "rules",
        now: NOW,
      }),
    ).toMatchObject({ ok: false, reason: "min_order" });

    await ctx.db
      .update(restaurantSettings)
      .set({ minOrderCents: 0 })
      .where(eq(restaurantSettings.restaurantId, fixture.restaurantId));

    expect(
      await createOrder(
        ctx.db,
        fixture.restaurantId,
        parsedInput(fixture, { changeFor: "5,00" }),
        { clientKey: "rules", now: NOW },
      ),
    ).toMatchObject({ ok: false, reason: "invalid_change" });

    expect(await ctx.db.select().from(orders)).toHaveLength(0);
  });

  it("bloqueia depois de 10 pedidos na mesma janela", async () => {
    const fixture = await seedRestaurant(ctx.db);

    for (let index = 0; index < 10; index += 1) {
      const result = await createOrder(
        ctx.db,
        fixture.restaurantId,
        parsedInput(fixture, {
          items: [
            { productId: fixture.drinkId, quantity: 1, optionIds: [], notes: "" },
          ],
        }),
        { clientKey: "rate-limit", now: NOW },
      );
      expect(result.ok).toBe(true);
    }

    const blocked = await createOrder(
      ctx.db,
      fixture.restaurantId,
      parsedInput(fixture, {
        items: [{ productId: fixture.drinkId, quantity: 1, optionIds: [], notes: "" }],
      }),
      { clientKey: "rate-limit", now: NOW },
    );

    expect(blocked).toMatchObject({ ok: false, reason: "rate_limited" });
    expect(await ctx.db.select().from(orders)).toHaveLength(10);
  });
});

describe("status e consultas do painel", () => {
  async function createFixtureOrder(fixture: Fixture) {
    const result = await createOrder(
      ctx.db,
      fixture.restaurantId,
      parsedInput(fixture, {
        type: "delivery",
        addressStreet: "Rua A",
        addressNumber: "1",
        addressDistrict: "Centro",
        items: [
          {
            productId: fixture.picanhaId,
            quantity: 1,
            optionIds: [fixture.aoPontoId],
            notes: "",
          },
        ],
      }),
      { clientKey: "status", now: NOW },
    );

    if (!result.ok) throw new Error(`pedido não criado: ${result.message}`);
    return result;
  }

  it("percorre o fluxo e recusa transições inválidas", async () => {
    const fixture = await seedRestaurant(ctx.db);
    const order = await createFixtureOrder(fixture);
    const actorUserId = randomUUID();

    expect(
      await updateOrderStatus(ctx.db, fixture.restaurantId, order.orderId, "confirmed", {
        actorUserId,
        now: NOW,
      }),
    ).toEqual({ ok: true });

    const [confirmed] = await ctx.db.select().from(orders).where(eq(orders.id, order.orderId));
    expect(confirmed?.status).toBe("confirmed");
    expect(confirmed?.confirmedAt).not.toBeNull();

    expect(
      await updateOrderStatus(ctx.db, fixture.restaurantId, order.orderId, "delivered", {
        actorUserId,
        now: NOW,
      }),
    ).toMatchObject({ ok: false, reason: "invalid_transition" });

    for (const status of ["preparing", "ready", "out_for_delivery", "delivered"] as const) {
      expect(
        await updateOrderStatus(ctx.db, fixture.restaurantId, order.orderId, status, {
          actorUserId,
          now: NOW,
        }),
      ).toEqual({ ok: true });
    }

    const [delivered] = await ctx.db.select().from(orders).where(eq(orders.id, order.orderId));
    expect(delivered?.status).toBe("delivered");
    expect(delivered?.deliveredAt).not.toBeNull();

    const events = await ctx.db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, order.orderId));
    expect(events).toHaveLength(6);

    expect(
      await updateOrderStatus(ctx.db, fixture.restaurantId, order.orderId, "canceled", {
        actorUserId,
        now: NOW,
      }),
    ).toMatchObject({ ok: false, reason: "invalid_transition" });
  });

  it("cancelar encerra impressão pendente e tarefa de WhatsApp", async () => {
    const fixture = await seedRestaurant(ctx.db);
    const order = await createFixtureOrder(fixture);

    expect(
      await updateOrderStatus(ctx.db, fixture.restaurantId, order.orderId, "canceled", {
        actorUserId: randomUUID(),
        reason: "cliente desistiu",
        now: NOW,
      }),
    ).toEqual({ ok: true });

    const [canceled] = await ctx.db.select().from(orders).where(eq(orders.id, order.orderId));
    expect(canceled?.status).toBe("canceled");
    expect(canceled?.cancelReason).toBe("cliente desistiu");

    const [job] = await ctx.db.select().from(printJobs).where(eq(printJobs.orderId, order.orderId));
    expect(job?.status).toBe("canceled");

    const [task] = await ctx.db
      .select()
      .from(whatsappTasks)
      .where(eq(whatsappTasks.orderId, order.orderId));
    expect(task?.status).toBe("skipped");

    const events = await ctx.db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, order.orderId));
    expect(events.some((event) => event.note.includes("cliente desistiu"))).toBe(true);
  });

  it("isola pedidos por restaurante e filtra a lista", async () => {
    const fixture = await seedRestaurant(ctx.db);
    const first = await createFixtureOrder(fixture);
    await createFixtureOrder(fixture);
    await createFixtureOrder(fixture);

    const [otherRestaurant] = await ctx.db
      .insert(restaurants)
      .values({ slug: "outro", name: "Outro" })
      .returning();
    if (!otherRestaurant) throw new Error("restaurante não criado");

    await updateOrderStatus(ctx.db, fixture.restaurantId, first.orderId, "confirmed", {
      actorUserId: null,
      now: NOW,
    });

    const all = await listOrdersForPanel(ctx.db, fixture.restaurantId);
    expect(all).toHaveLength(3);

    const pending = await listOrdersForPanel(ctx.db, fixture.restaurantId, {
      statuses: ["pending"],
    });
    expect(pending).toHaveLength(2);

    const confirmed = await listOrdersForPanel(ctx.db, fixture.restaurantId, {
      statuses: ["confirmed"],
    });
    expect(confirmed.map((order) => order.id)).toEqual([first.orderId]);

    const counts = await countOrdersByStatus(ctx.db, fixture.restaurantId);
    expect(counts.pending).toBe(2);
    expect(counts.confirmed).toBe(1);

    expect(await listOrdersForPanel(ctx.db, otherRestaurant.id)).toEqual([]);
    expect(await getOrderForPanel(ctx.db, otherRestaurant.id, first.orderId)).toBeNull();
    expect(
      await updateOrderStatus(ctx.db, otherRestaurant.id, first.orderId, "canceled", {
        actorUserId: null,
        now: NOW,
      }),
    ).toMatchObject({ ok: false, reason: "not_found" });
  });
});
