import { eq } from "drizzle-orm";

import type { Db } from "@/server/db/types";
import { restaurantSettings, restaurantUsers, restaurants } from "@/server/db/schema";

export type Member = {
  userId: string;
  restaurantId: string;
  restaurantSlug: string;
  restaurantName: string;
  restaurantTimezone: string;
  role: "owner" | "staff";
};

/**
 * Autorização real do painel: o usuário precisa existir em `restaurant_users`.
 * Um usuário autenticado no Supabase sem vínculo NÃO tem acesso.
 */
export async function findMember(db: Db, userId: string): Promise<Member | null> {
  const [row] = await db
    .select({
      userId: restaurantUsers.userId,
      restaurantId: restaurantUsers.restaurantId,
      role: restaurantUsers.role,
      restaurantSlug: restaurants.slug,
      restaurantName: restaurants.name,
      restaurantTimezone: restaurants.timezone,
    })
    .from(restaurantUsers)
    .innerJoin(restaurants, eq(restaurants.id, restaurantUsers.restaurantId))
    .where(eq(restaurantUsers.userId, userId))
    .limit(1);

  return row ?? null;
}

export type SettingsForPanel = {
  phone: string;
  addressLine: string;
  deliveryFeeCents: number;
  minOrderCents: number;
  deliveryEnabled: boolean;
  isManuallyClosed: boolean;
  closedMessage: string;
};

export async function getSettingsForPanel(
  db: Db,
  restaurantId: string,
): Promise<SettingsForPanel | null> {
  const [row] = await db
    .select({
      phone: restaurantSettings.phone,
      addressLine: restaurantSettings.addressLine,
      deliveryFeeCents: restaurantSettings.deliveryFeeCents,
      minOrderCents: restaurantSettings.minOrderCents,
      deliveryEnabled: restaurantSettings.deliveryEnabled,
      isManuallyClosed: restaurantSettings.isManuallyClosed,
      closedMessage: restaurantSettings.closedMessage,
    })
    .from(restaurantSettings)
    .where(eq(restaurantSettings.restaurantId, restaurantId))
    .limit(1);

  return row ?? null;
}
