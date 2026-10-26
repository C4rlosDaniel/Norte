import { asc, eq } from "drizzle-orm";

import type { Db } from "@/server/db/types";
import {
  businessHours,
  restaurantSettings,
  restaurants,
  type BusinessHour,
  type Restaurant,
  type RestaurantSettings,
} from "@/server/db/schema";

export type RestaurantSnapshot = {
  restaurant: Restaurant;
  settings: RestaurantSettings;
  hours: BusinessHour[];
};

export async function getRestaurantBySlug(db: Db, slug: string): Promise<Restaurant | null> {
  const [row] = await db.select().from(restaurants).where(eq(restaurants.slug, slug)).limit(1);
  return row ?? null;
}

export async function getRestaurantById(db: Db, id: string): Promise<Restaurant | null> {
  const [row] = await db.select().from(restaurants).where(eq(restaurants.id, id)).limit(1);
  return row ?? null;
}

export async function getRestaurantSnapshot(
  db: Db,
  restaurantId: string,
): Promise<RestaurantSnapshot | null> {
  const [row] = await db
    .select({ restaurant: restaurants, settings: restaurantSettings })
    .from(restaurants)
    .innerJoin(restaurantSettings, eq(restaurantSettings.restaurantId, restaurants.id))
    .where(eq(restaurants.id, restaurantId))
    .limit(1);

  if (!row) return null;

  const hours = await db
    .select()
    .from(businessHours)
    .where(eq(businessHours.restaurantId, restaurantId))
    .orderBy(asc(businessHours.weekday), asc(businessHours.opensAt));

  return { restaurant: row.restaurant, settings: row.settings, hours };
}

export async function listRestaurantsWithSettings(db: Db): Promise<
  Array<{ restaurant: Restaurant; settings: RestaurantSettings }>
> {
  return db
    .select({ restaurant: restaurants, settings: restaurantSettings })
    .from(restaurants)
    .innerJoin(restaurantSettings, eq(restaurantSettings.restaurantId, restaurants.id))
    .orderBy(asc(restaurants.name));
}
