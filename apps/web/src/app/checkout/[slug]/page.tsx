import { notFound } from "next/navigation";

import { CheckoutClient } from "@/components/checkout/checkout-client";
import { getDb } from "@/server/db/client";
import { getPublicMenu } from "@/server/menu/queries";
import { evaluateOpenState } from "@/server/restaurant/business-hours";
import { getRestaurantBySlug, getRestaurantSnapshot } from "@/server/restaurant/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: { absolute: "Finalizar pedido" } };

export default async function CheckoutPage({
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

  const openState = evaluateOpenState({
    hours: snapshot.hours,
    now: new Date(),
    timeZone: snapshot.restaurant.timezone,
    manuallyClosed: snapshot.settings.isManuallyClosed,
    deliveryEnabled: snapshot.settings.deliveryEnabled,
  });

  return (
    <CheckoutClient
      restaurant={snapshot.restaurant}
      settings={snapshot.settings}
      openState={openState}
      menu={menu}
    />
  );
}
