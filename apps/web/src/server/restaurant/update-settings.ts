import { eq } from "drizzle-orm";

import type { Db } from "@/server/db/types";
import { restaurantSettings, restaurants } from "@/server/db/schema";
import type { SettingsInput } from "@/server/restaurant/settings-schema";

/**
 * Caso de uso: grava as configurações do restaurante.
 * Recebe o banco por parâmetro para poder ser testado com Postgres real (PGlite).
 */
export async function updateSettings(
  db: Db,
  restaurantId: string,
  input: SettingsInput,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(restaurantSettings)
      .set({
        phone: input.phone,
        addressLine: input.addressLine,
        deliveryFeeCents: input.deliveryFee,
        deliveryEnabled: input.deliveryEnabled,
        isManuallyClosed: input.isManuallyClosed,
        closedMessage: input.closedMessage,
        updatedAt: new Date(),
      })
      .where(eq(restaurantSettings.restaurantId, restaurantId));

    await tx
      .update(restaurants)
      .set({ updatedAt: new Date() })
      .where(eq(restaurants.id, restaurantId));
  });
}
