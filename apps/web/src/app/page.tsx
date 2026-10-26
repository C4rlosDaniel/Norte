import { PublicMenuView } from "@/components/public-menu-view";
import { getDb } from "@/server/db/client";
import { getEnv } from "@/server/env";
import { getPublicMenu } from "@/server/menu/queries";
import { getRestaurantBySlug, getRestaurantSnapshot } from "@/server/restaurant/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const env = getEnv();
  const db = getDb();

  const restaurant = await getRestaurantBySlug(db, env.RESTAURANT_SLUG);

  if (!restaurant) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6 py-16">
        <h1 className="font-display text-3xl">Restaurante não configurado</h1>
        <p className="text-ink-soft">
          O banco respondeu, mas não existe restaurante com o slug{" "}
          <code className="rounded bg-kraft-dark px-1.5 py-0.5 font-mono text-sm">
            {env.RESTAURANT_SLUG}
          </code>
          .
        </p>
        <p className="text-sm text-ink-soft">
          Rode <code className="font-mono">npm run db:seed</code> em{" "}
          <code className="font-mono">apps/web</code> para criar os dados de desenvolvimento.
        </p>
      </main>
    );
  }

  const [snapshot, menu] = await Promise.all([
    getRestaurantSnapshot(db, restaurant.id),
    getPublicMenu(db, restaurant.id),
  ]);

  if (!snapshot) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="font-display text-3xl">{restaurant.name}</h1>
        <p className="mt-3 text-ink-soft">
          Cadastro incompleto: faltam as configurações do restaurante. Rode o seed novamente.
        </p>
      </main>
    );
  }

  return (
    <PublicMenuView
      restaurant={snapshot.restaurant}
      settings={snapshot.settings}
      hours={snapshot.hours}
      menu={menu}
    />
  );
}
