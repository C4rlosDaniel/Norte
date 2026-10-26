import { StatusBadge, closedReasonLabel } from "@/components/status-badge";
import type { BusinessHour, Restaurant, RestaurantSettings } from "@/server/db/schema";
import { formatBRL } from "@/server/money";
import { evaluateOpenState } from "@/server/restaurant/business-hours";
import type { MenuProduct, PublicMenu } from "@/server/menu/queries";

function ModifierSummary({ product }: { product: MenuProduct }) {
  if (product.modifierGroups.length === 0) return null;

  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs font-semibold underline underline-offset-2">
        Adicionais
      </summary>
      <ul className="mt-2 space-y-1 text-xs text-ink-soft">
        {product.modifierGroups.map((group) => (
          <li key={group.id}>
            <span className="font-semibold">{group.name}</span>
            {group.minSelections > 0 ? " (obrigatório)" : " (opcional)"}:{" "}
            {group.options
              .map((option) =>
                option.priceCents > 0
                  ? `${option.name} +${formatBRL(option.priceCents)}`
                  : option.name,
              )
              .join(" · ")}
          </li>
        ))}
      </ul>
    </details>
  );
}

function ProductCard({ product }: { product: MenuProduct }) {
  return (
    <article
      id={`produto-${product.id}`}
      className={`card scroll-mt-20 p-4 ${product.isAvailable ? "" : "opacity-70"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{product.name}</h3>
            {product.servesLabel ? (
              <span className="text-xs text-ink-soft">{product.servesLabel}</span>
            ) : null}
            {product.badge ? <span className="badge badge-open">{product.badge}</span> : null}
            {product.isAvailable ? null : (
              <span className="badge badge-closed">Indisponível</span>
            )}
          </div>

          {product.description ? (
            <p className="mt-1 text-sm text-ink-soft">{product.description}</p>
          ) : null}

          <ModifierSummary product={product} />
        </div>

        <p className="whitespace-nowrap font-semibold">{formatBRL(product.priceCents)}</p>
      </div>
    </article>
  );
}

export function PublicMenuView({
  restaurant,
  settings,
  hours,
  menu,
}: {
  restaurant: Restaurant;
  settings: RestaurantSettings;
  hours: BusinessHour[];
  menu: PublicMenu;
}) {
  const state = evaluateOpenState({
    hours,
    now: new Date(),
    timeZone: restaurant.timezone,
    manuallyClosed: settings.isManuallyClosed,
    deliveryEnabled: settings.deliveryEnabled,
  });

  const statusText = state.isOpen
    ? state.deliveryAllowed
      ? "Entrega disponível neste horário"
      : "Somente retirada neste horário"
    : closedReasonLabel(state);

  const phoneDigits = settings.phone.replace(/\D/g, "");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-terracotta">Cardápio</p>
        <h1 className="font-display text-4xl leading-tight">{restaurant.name}</h1>

        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge state={state} />
          <span className="text-sm text-ink-soft">{statusText}</span>
        </div>

        <div className="card grid gap-2 p-4 text-sm sm:grid-cols-2">
          <p>
            <span className="text-ink-soft">Endereço: </span>
            {settings.addressLine || "—"}
          </p>
          <p>
            <span className="text-ink-soft">Telefone: </span>
            {settings.phone ? (
              <a className="font-semibold underline underline-offset-2" href={`tel:${phoneDigits}`}>
                {settings.phone}
              </a>
            ) : (
              "—"
            )}
          </p>
          <p>
            <span className="text-ink-soft">Entrega: </span>
            {settings.deliveryEnabled ? formatBRL(settings.deliveryFeeCents) : "Somente retirada"}
          </p>
          {settings.minOrderCents > 0 ? (
            <p>
              <span className="text-ink-soft">Pedido mínimo: </span>
              {formatBRL(settings.minOrderCents)}
            </p>
          ) : null}
        </div>
      </header>

      {menu.categories.length === 0 ? (
        <section className="card mt-6 flex flex-col items-center gap-2 px-6 py-14 text-center">
          <p className="font-semibold">Cardápio em preparação</p>
          <p className="max-w-sm text-sm text-ink-soft">
            O restaurante ainda não cadastrou itens. Fale com a equipe pelo telefone acima.
          </p>
        </section>
      ) : (
        <>
          <nav
            aria-label="Categorias do cardápio"
            className="sticky top-0 z-10 -mx-4 mt-6 border-y border-leather/15 bg-kraft/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6"
          >
            <ul className="flex gap-2 overflow-x-auto text-sm">
              {menu.featured.length > 0 ? (
                <li>
                  <a
                    href="#mais-pedidos"
                    className="inline-flex whitespace-nowrap rounded-full border border-leather/20 bg-paper px-3 py-1 font-semibold"
                  >
                    Mais pedidos
                  </a>
                </li>
              ) : null}
              {menu.categories.map((category) => (
                <li key={category.id}>
                  <a
                    href={`#cat-${category.id}`}
                    className="inline-flex whitespace-nowrap rounded-full border border-leather/20 bg-paper px-3 py-1 font-semibold"
                  >
                    {category.name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <main className="mt-6 space-y-8">
            {menu.featured.length > 0 ? (
              <section id="mais-pedidos" className="scroll-mt-16 space-y-3">
                <h2 className="font-display text-2xl">Os mais pedidos</h2>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {menu.featured.map((product) => (
                    <li key={product.id}>
                      <a
                        href={`#produto-${product.id}`}
                        className="card flex items-center justify-between gap-3 p-3 text-sm hover:bg-paper"
                      >
                        <span className="font-semibold">{product.name}</span>
                        <span className="whitespace-nowrap text-ink-soft">
                          {formatBRL(product.priceCents)}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {menu.categories.map((category) => (
              <section key={category.id} id={`cat-${category.id}`} className="scroll-mt-16 space-y-3">
                <div>
                  <h2 className="font-display text-2xl">{category.name}</h2>
                  {category.description ? (
                    <p className="text-sm text-ink-soft">{category.description}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  {category.products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </section>
            ))}
          </main>
        </>
      )}

      <footer className="mt-10 border-t border-leather/15 pt-4 text-xs text-ink-soft">
        {restaurant.name} · cardápio atualizado pela equipe do restaurante.
      </footer>
    </div>
  );
}
