import { notFound } from "next/navigation";

import { PublicMenuView } from "@/components/public-menu-view";
import { getDb } from "@/server/db/client";
import { getPublicMenu } from "@/server/menu/queries";
import { evaluateOpenState } from "@/server/restaurant/business-hours";
import { getRestaurantBySlug, getRestaurantSnapshot } from "@/server/restaurant/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: { absolute: "Cardápio" } };

export default async function PublicMenuPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = getDb();

  const restaurant = await getRestaurantBySlug(db, slug);

  if (!restaurant) notFound();

  const [snapshot, menu] = await Promise.all([
    getRestaurantSnapshot(db, restaurant.id),
    getPublicMenu(db, restaurant.id),
  ]);

  if (!snapshot) notFound();

  return (
    <PublicMenuView
      restaurant={snapshot.restaurant}
      settings={snapshot.settings}
      openState={evaluateOpenState({
        hours: snapshot.hours,
        now: new Date(),
        timeZone: snapshot.restaurant.timezone,
        manuallyClosed: snapshot.settings.isManuallyClosed,
        deliveryEnabled: snapshot.settings.deliveryEnabled,
      })}
      menu={menu}
    />
  );
}
