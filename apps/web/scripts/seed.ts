import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

import { createDb } from "@/server/db/client";
import { businessHours, restaurantSettings, restaurants } from "@/server/db/schema";
import { getRestaurantBySlug } from "@/server/restaurant/queries";
import { seedMenu } from "./seed-menu";

/**
 * Seed de DESENVOLVIMENTO. Idempotente e não destrutivo:
 * só cria o que estiver faltando, nunca sobrescreve dados editados no painel.
 */
async function main() {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL ausente. Configure apps/web/.env.local.");

  const slug = process.env["RESTAURANT_SLUG"] ?? "amigos-do-norte";
  const db = createDb(url);

  console.log(`[seed] banco conectado · slug=${slug}`);

  let restaurant = await getRestaurantBySlug(db, slug);

  if (!restaurant) {
    const [created] = await db
      .insert(restaurants)
      .values({
        slug,
        name: "Amigos do Norte",
        timezone: "America/Sao_Paulo",
      })
      .returning();

    if (!created) throw new Error("Falha ao criar o restaurante.");
    restaurant = created;
    console.log(`[seed] restaurante criado: ${created.id}`);
  } else {
    console.log(`[seed] restaurante já existia: ${restaurant.id}`);
  }

  await db
    .insert(restaurantSettings)
    .values({
      restaurantId: restaurant.id,
      phone: "(11) 95194-6185",
      addressLine: "R. Damásio Pinto, 57 — Parada XV de Novembro, São Paulo - SP",
      deliveryFeeCents: 500,
      minOrderCents: 0,
      deliveryEnabled: true,
      isManuallyClosed: false,
      closedMessage:
        "Estamos fechados agora. Voltamos no próximo horário de funcionamento. Você pode deixar sua mensagem por aqui.",
    })
    .onConflictDoNothing();

  const hours: Array<typeof businessHours.$inferInsert> = Array.from(
    { length: 6 },
    (_, index) => index + 1,
  ).map((weekday) => ({
    restaurantId: restaurant.id,
    weekday,
    opensAt: "11:00:00",
    closesAt: "22:00:00",
    acceptsDeliveryUntil: "20:30:00",
    isClosed: false,
  }));

  hours.push({
    restaurantId: restaurant.id,
    weekday: 0,
    opensAt: "11:00:00",
    closesAt: "22:00:00",
    acceptsDeliveryUntil: null,
    isClosed: true,
  });

  await db.insert(businessHours).values(hours).onConflictDoNothing();

  await seedMenu(db, restaurant.id, { reset: process.env["SEED_RESET_MENU"] === "1" });

  console.log("[seed] configurações e horários garantidos (dados de DEMONSTRAÇÃO).");
  console.log("[seed] concluído.");
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("[seed] falhou:", error);
    process.exit(1);
  });
