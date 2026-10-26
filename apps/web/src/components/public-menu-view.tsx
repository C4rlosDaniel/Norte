"use client";

import { useEffect, useMemo, useState } from "react";

import { StatusBadge, closedReasonLabel } from "@/components/status-badge";
import type { Restaurant, RestaurantSettings } from "@/server/db/schema";
import { formatBRL } from "@/server/money";
import type { OpenState } from "@/server/restaurant/business-hours";
import type { MenuProduct, PublicMenu } from "@/server/menu/queries";

import {
  CART_MAX_QUANTITY,
  cartItemCount,
  cartKey,
  cartSubtotal,
  clearStoredCart,
  loadStoredCart,
  mergeCartLine,
  resolveCart,
  saveStoredCart,
  type StoredCartLine,
} from "./menu/cart";
import { CartDrawer } from "./menu/cart-drawer";
import { ProductDialog } from "./menu/product-dialog";

function ModifierSummary({ product }: { product: MenuProduct }) {
  if (product.modifierGroups.length === 0) return null;

  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs font-semibold underline underline-offset-2">
        Ver opções
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

function ProductCard({
  product,
  orderingDisabled,
  onAdd,
  onChoose,
}: {
  product: MenuProduct;
  orderingDisabled: boolean;
  onAdd: () => void;
  onChoose: () => void;
}) {
  const hasOptions = product.modifierGroups.length > 0;
  const canOrder = product.isAvailable && !orderingDisabled;

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

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          className="btn btn-secondary px-3 py-1.5 text-xs"
          disabled={!canOrder}
          onClick={hasOptions ? onChoose : onAdd}
          aria-label={`${hasOptions ? "Escolher" : "Adicionar"} ${product.name}`}
        >
          {!product.isAvailable
            ? "Indisponível"
            : orderingDisabled
              ? "Fechado"
              : hasOptions
                ? "Escolher"
                : "Adicionar"}
        </button>
      </div>
    </article>
  );
}

export function PublicMenuView({
  restaurant,
  settings,
  openState,
  menu,
}: {
  restaurant: Restaurant;
  settings: RestaurantSettings;
  openState: OpenState;
  menu: PublicMenu;
}) {
  const [lines, setLines] = useState<StoredCartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [editing, setEditing] = useState<MenuProduct | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const catalog = useMemo(
    () =>
      new Map(
        menu.categories
          .flatMap((category) => category.products)
          .map((product) => [product.id, product]),
      ),
    [menu],
  );
  const resolved = useMemo(() => resolveCart(catalog, lines), [catalog, lines]);

  const orderingDisabled = !openState.isOpen;
  const count = cartItemCount(lines);
  const subtotal = cartSubtotal(resolved);
  const phoneDigits = settings.phone.replace(/\D/g, "");

  useEffect(() => {
    // Lê o carrinho salvo depois da hidratação, sem divergir do HTML inicial.
    const timer = window.setTimeout(() => {
      setLines(loadStoredCart(restaurant.slug));
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [restaurant.slug]);

  useEffect(() => {
    if (!hydrated) return;
    saveStoredCart(restaurant.slug, lines);
  }, [hydrated, lines, restaurant.slug]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function addLine(line: StoredCartLine) {
    setLines((previous) => mergeCartLine(previous, line));
    setEditing(null);
    setToast("Adicionado ao carrinho.");
  }

  function changeQuantity(key: string, quantity: number) {
    const target = resolved.find((item) => item.key === key);
    if (!target) return;

    const nextQuantity = Math.min(Math.max(quantity, 1), CART_MAX_QUANTITY);

    setLines((previous) =>
      previous.map((line) =>
        line === target.line ? { ...line, quantity: nextQuantity } : line,
      ),
    );
  }

  function removeLine(key: string) {
    setLines((previous) =>
      previous.filter(
        (line) => cartKey(line.productId, line.optionIds, line.notes) !== key,
      ),
    );
  }

  function clearCart() {
    if (!window.confirm("Limpar todo o carrinho?")) return;
    setLines([]);
    clearStoredCart(restaurant.slug);
  }

  const statusText = openState.isOpen
    ? openState.deliveryAllowed
      ? "Entrega disponível neste horário"
      : "Somente retirada neste horário"
    : closedReasonLabel(openState);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-28 sm:px-6">
      <header className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-terracotta">Cardápio</p>
        <h1 className="font-display text-4xl leading-tight">{restaurant.name}</h1>

        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge state={openState} />
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
                    <ProductCard
                      key={product.id}
                      product={product}
                      orderingDisabled={orderingDisabled}
                      onAdd={() =>
                        addLine({
                          productId: product.id,
                          quantity: 1,
                          optionIds: [],
                          notes: "",
                        })
                      }
                      onChoose={() => setEditing(product)}
                    />
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

      {toast ? (
        <p
          role="status"
          className="fixed inset-x-4 bottom-24 z-30 mx-auto max-w-sm rounded-xl bg-leather px-4 py-2 text-center text-sm font-semibold text-paper shadow-lg"
        >
          {toast}
        </p>
      ) : null}

      {hydrated && lines.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-leather/20 bg-paper/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div className="min-w-0 text-sm">
              <p className="font-semibold">
                {count} {count === 1 ? "item" : "itens"} · {formatBRL(subtotal)}
              </p>
              <p className="truncate text-xs text-ink-soft">Taxa de entrega no checkout</p>
            </div>
            <button
              type="button"
              className="btn btn-primary whitespace-nowrap"
              onClick={() => setCartOpen(true)}
            >
              Ver carrinho
            </button>
          </div>
        </div>
      ) : null}

      <CartDrawer
        slug={restaurant.slug}
        open={cartOpen}
        lines={lines}
        resolved={resolved}
        onClose={() => setCartOpen(false)}
        onChangeQuantity={changeQuantity}
        onRemove={removeLine}
        onClear={clearCart}
      />

      <ProductDialog
        product={editing}
        orderingDisabled={orderingDisabled}
        onClose={() => setEditing(null)}
        onAdd={addLine}
      />
    </div>
  );
}
