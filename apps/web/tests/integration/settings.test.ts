import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { restaurantSettings, restaurants } from "@/server/db/schema";
import { settingsInputSchema } from "@/server/restaurant/settings-schema";
import { updateSettings } from "@/server/restaurant/update-settings";
import { createTestDatabase, type TestDatabase } from "./helpers/database";

let ctx: TestDatabase;

beforeEach(async () => {
  ctx = await createTestDatabase();
});

afterEach(async () => {
  await ctx.client.close();
});

async function seedRestaurant() {
  const [restaurant] = await ctx.db
    .insert(restaurants)
    .values({ slug: "teste", name: "Restaurante de Teste" })
    .returning();

  if (!restaurant) throw new Error("restaurante de teste não criado");

  await ctx.db.insert(restaurantSettings).values({
    restaurantId: restaurant.id,
    phone: "(11) 90000-0000",
    addressLine: "Rua A, 1",
    closedMessage: "Fechado.",
  });

  return restaurant;
}

describe("updateSettings", () => {
  it("persiste os valores convertendo a taxa para centavos", async () => {
    const restaurant = await seedRestaurant();

    const input = settingsInputSchema.parse({
      phone: "(11) 98888-7777",
      addressLine: "Av. Brasil, 500 — Centro",
      deliveryFee: "7,50",
      deliveryEnabled: false,
      isManuallyClosed: true,
      closedMessage: "Voltamos amanhã.",
    });

    await updateSettings(ctx.db, restaurant.id, input);

    const [row] = await ctx.db.select().from(restaurantSettings).limit(1);

    expect(row?.deliveryFeeCents).toBe(750);
    expect(row?.deliveryEnabled).toBe(false);
    expect(row?.isManuallyClosed).toBe(true);
    expect(row?.phone).toBe("(11) 98888-7777");
    expect(row?.closedMessage).toBe("Voltamos amanhã.");
  });

  it("não grava taxa negativa (constraint do banco)", async () => {
    const restaurant = await seedRestaurant();

    await expect(
      ctx.db
        .update(restaurantSettings)
        .set({ deliveryFeeCents: -1 })
        .where(eq(restaurantSettings.restaurantId, restaurant.id)),
    ).rejects.toThrow();
  });
});
