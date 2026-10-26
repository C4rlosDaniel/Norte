import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { restaurantUsers, restaurants } from "@/server/db/schema";
import { findMember } from "@/server/restaurant/members";
import { createTestDatabase, type TestDatabase } from "./helpers/database";

let ctx: TestDatabase;

beforeEach(async () => {
  ctx = await createTestDatabase();
});

afterEach(async () => {
  await ctx.client.close();
});

async function seedRestaurantWithMember() {
  const [restaurant] = await ctx.db
    .insert(restaurants)
    .values({ slug: "teste", name: "Restaurante de Teste", timezone: "America/Sao_Paulo" })
    .returning();

  if (!restaurant) throw new Error("restaurante de teste não criado");

  const userId = "11111111-1111-4111-8111-111111111111";

  await ctx.db.insert(restaurantUsers).values({
    userId,
    restaurantId: restaurant.id,
    role: "owner",
  });

  return { restaurant, userId };
}

describe("findMember (autorização do painel)", () => {
  it("devolve o vínculo do usuário com o restaurante", async () => {
    const { restaurant, userId } = await seedRestaurantWithMember();

    const member = await findMember(ctx.db, userId);

    expect(member).not.toBeNull();
    expect(member?.restaurantId).toBe(restaurant.id);
    expect(member?.restaurantSlug).toBe("teste");
    expect(member?.role).toBe("owner");
  });

  it("devolve null para usuário autenticado sem vínculo", async () => {
    await seedRestaurantWithMember();

    const member = await findMember(ctx.db, "22222222-2222-4222-8222-222222222222");

    expect(member).toBeNull();
  });
});

describe("constraints das migrações", () => {
  it("impede dois restaurantes com o mesmo slug", async () => {
    await ctx.db.insert(restaurants).values({ slug: "repetido", name: "A" });

    await expect(ctx.db.insert(restaurants).values({ slug: "repetido", name: "B" })).rejects.toThrow();
  });

  it("impede dois vínculos para o mesmo usuário", async () => {
    const { userId } = await seedRestaurantWithMember();

    const [other] = await ctx.db
      .insert(restaurants)
      .values({ slug: "outro", name: "Outro" })
      .returning();

    await expect(
      ctx.db.insert(restaurantUsers).values({
        userId,
        restaurantId: other!.id,
      }),
    ).rejects.toThrow();
  });

  it("remove o vínculo em cascata quando o restaurante é apagado", async () => {
    const { restaurant, userId } = await seedRestaurantWithMember();

    await ctx.db.delete(restaurants).where(eq(restaurants.id, restaurant.id));

    const rows = await ctx.db.select().from(restaurantUsers).where(eq(restaurantUsers.userId, userId));
    expect(rows).toHaveLength(0);
  });
});
