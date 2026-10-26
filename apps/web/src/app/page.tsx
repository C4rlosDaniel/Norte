import { StatusBadge, closedReasonLabel } from "@/components/status-badge";
import { getDb } from "@/server/db/client";
import { getEnv } from "@/server/env";
import { formatBRL } from "@/server/money";
import { evaluateOpenState } from "@/server/restaurant/business-hours";
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

  const snapshot = await getRestaurantSnapshot(db, restaurant.id);
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

  const state = evaluateOpenState({
    hours: snapshot.hours,
    now: new Date(),
    timeZone: snapshot.restaurant.timezone,
    manuallyClosed: snapshot.settings.isManuallyClosed,
    deliveryEnabled: snapshot.settings.deliveryEnabled,
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-6 py-16">
      <header className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-terracotta">Cardápio</p>
        <h1 className="font-display text-4xl leading-tight">{snapshot.restaurant.name}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge state={state} />
          <span className="text-sm text-ink-soft">{closedReasonLabel(state)}</span>
        </div>
      </header>

      <section className="card space-y-3 p-6">
        <h2 className="font-display text-xl">Em construção</h2>
        <p className="text-sm text-ink-soft">
          A fundação já está de pé: banco, autenticação do painel, horários e configurações. O
          cardápio público entra na Fase 2 e o pedido na Fase 3.
        </p>
        <dl className="grid gap-2 border-t border-leather/10 pt-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">Taxa de entrega</dt>
            <dd className="font-semibold">
              {snapshot.settings.deliveryEnabled
                ? formatBRL(snapshot.settings.deliveryFeeCents)
                : "Entrega desativada"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">Endereço</dt>
            <dd className="text-right font-semibold">{snapshot.settings.addressLine || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">Telefone</dt>
            <dd className="font-semibold">{snapshot.settings.phone || "—"}</dd>
          </div>
        </dl>
      </section>

      <footer className="text-xs text-ink-soft">
        Acesso da equipe:{" "}
        <a className="font-semibold underline" href="/painel">
          painel do restaurante
        </a>
      </footer>
    </main>
  );
}
