"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";

import { createOrderAction, type CheckoutActionState } from "@/app/checkout/actions";
import type { Restaurant, RestaurantSettings } from "@/server/db/schema";
import { formatBRL, parseBRLToCents } from "@/server/money";
import type { PublicMenu } from "@/server/menu/queries";
import type { OpenState } from "@/server/restaurant/business-hours";
import { paymentMethodLabel } from "@/server/orders/status";

import {
  cartItemCount,
  cartKey,
  cartSubtotal,
  clearCheckoutKey,
  clearStoredCart,
  getCheckoutKey,
  hasCartErrors,
  loadStoredCart,
  resolveCart,
  saveStoredCart,
  type StoredCartLine,
} from "../menu/cart";

const initialState: CheckoutActionState = { status: "idle" };

type OrderTypeValue = "delivery" | "pickup";
type PaymentMethodValue = "cash" | "card" | "pix";

function FieldError({ messages }: { messages?: string[] | undefined }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs font-medium text-terracotta">{messages[0]}</p>;
}

function validPaymentMethods(settings: RestaurantSettings): PaymentMethodValue[] {
  return settings.paymentMethods.filter(
    (method): method is PaymentMethodValue =>
      method === "cash" || method === "card" || method === "pix",
  );
}

export function CheckoutClient({
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
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createOrderAction, initialState);
  const [lines, setLines] = useState<StoredCartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [type, setType] = useState<OrderTypeValue>(
    settings.deliveryEnabled && openState.deliveryAllowed ? "delivery" : "pickup",
  );

  const payments = validPaymentMethods(settings);
  const [payment, setPayment] = useState<PaymentMethodValue>(payments[0] ?? "cash");
  const [changeFor, setChangeFor] = useState("");

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

  const subtotal = cartSubtotal(resolved);
  const deliveryFee = type === "delivery" ? settings.deliveryFeeCents : 0;
  const total = subtotal + deliveryFee;
  const errors = hasCartErrors(resolved);
  const count = cartItemCount(lines);

  const deliveryPossible = settings.deliveryEnabled && openState.deliveryAllowed;
  const belowMinimum = settings.minOrderCents > 0 && subtotal < settings.minOrderCents;

  const changeCents = changeFor.trim().length === 0 ? null : parseBRLToCents(changeFor);
  const changeError =
    payment === "cash" && changeFor.trim().length > 0 && (changeCents === null || changeCents < total)
      ? `O troco precisa ser de pelo menos ${formatBRL(total)}.`
      : null;

  useEffect(() => {
    // localStorage só existe no cliente; agenda a leitura para depois da
    // hidratação e evita divergência entre o HTML do servidor e o carrinho.
    const timer = window.setTimeout(() => {
      setLines(loadStoredCart(restaurant.slug));
      setIdempotencyKey(getCheckoutKey(restaurant.slug));
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [restaurant.slug]);

  useEffect(() => {
    if (state.status !== "success") return;

    clearStoredCart(restaurant.slug);
    clearCheckoutKey(restaurant.slug);
    router.replace(`/pedido/${state.orderCode}`);
  }, [state, router, restaurant.slug]);

  function removeLine(key: string) {
    setLines((previous) => {
      const next = previous.filter(
        (line) => cartKey(line.productId, line.optionIds, line.notes) !== key,
      );
      saveStoredCart(restaurant.slug, next);
      return next;
    });
  }

  const canSubmit =
    hydrated &&
    idempotencyKey.length > 0 &&
    resolved.length > 0 &&
    !errors &&
    !belowMinimum &&
    !changeError &&
    openState.isOpen &&
    payments.length > 0 &&
    (type === "pickup" || deliveryPossible) &&
    !pending;

  if (!hydrated) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="card p-6">
          <p className="font-semibold">Carregando seu carrinho…</p>
        </div>
      </main>
    );
  }

  if (resolved.length === 0) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl">Seu carrinho está vazio</h1>
        <p className="text-sm text-ink-soft">
          Escolha itens no cardápio para finalizar um pedido.
        </p>
        <Link href={`/cardapio/${restaurant.slug}`} className="btn btn-primary">
          Voltar ao cardápio
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 pb-20 sm:px-6">
      <header className="space-y-2">
        <Link
          href={`/cardapio/${restaurant.slug}`}
          className="text-xs font-semibold text-ink-soft underline underline-offset-2"
        >
          ← Voltar ao cardápio
        </Link>
        <h1 className="font-display text-3xl">Finalizar pedido</h1>
        <p className="text-sm text-ink-soft">
          {restaurant.name} · {count} {count === 1 ? "item" : "itens"}
        </p>
      </header>

      {!openState.isOpen ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm font-semibold text-terracotta"
        >
          O restaurante está fechado agora. Você pode revisar o carrinho, mas o pedido só pode ser
          enviado no horário de funcionamento.
        </p>
      ) : null}

      {state.status === "error" ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm font-semibold text-terracotta"
        >
          {state.message}
        </p>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px] lg:items-start">
        <form action={formAction} className="card space-y-6 p-5 sm:p-6">
          <input type="hidden" name="slug" value={restaurant.slug} />
          <input type="hidden" name="cart" value={JSON.stringify(lines)} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

          <section className="space-y-3">
            <h2 className="font-display text-xl">Seus dados</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="customerName">
                  Nome
                </label>
                <input
                  id="customerName"
                  name="customerName"
                  className="input"
                  autoComplete="name"
                  maxLength={80}
                  required
                />
                <FieldError
                  messages={state.status === "error" ? state.fieldErrors?.["customerName"] : undefined}
                />
              </div>
              <div>
                <label className="label" htmlFor="customerPhone">
                  WhatsApp / telefone
                </label>
                <input
                  id="customerPhone"
                  name="customerPhone"
                  className="input"
                  autoComplete="tel"
                  inputMode="tel"
                  maxLength={20}
                  placeholder="(11) 99999-9999"
                  required
                />
                <FieldError
                  messages={
                    state.status === "error" ? state.fieldErrors?.["customerPhone"] : undefined
                  }
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl">Entrega ou retirada</h2>

            <div className="grid gap-2 sm:grid-cols-2">
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border border-leather/20 p-3 text-sm ${
                  deliveryPossible ? "" : "opacity-60"
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value="delivery"
                  checked={type === "delivery"}
                  disabled={!deliveryPossible}
                  onChange={() => setType("delivery")}
                  className="mt-1"
                />
                <span>
                  <span className="block font-semibold">Entrega</span>
                  <span className="block text-xs text-ink-soft">
                    {settings.deliveryEnabled
                      ? `Taxa ${formatBRL(settings.deliveryFeeCents)}${
                          openState.deliveryAllowed ? "" : " · fora do horário de entrega"
                        }`
                      : "Entrega desativada"}
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-leather/20 p-3 text-sm">
                <input
                  type="radio"
                  name="type"
                  value="pickup"
                  checked={type === "pickup"}
                  onChange={() => setType("pickup")}
                  className="mt-1"
                />
                <span>
                  <span className="block font-semibold">Retirada no restaurante</span>
                  <span className="block text-xs text-ink-soft">
                    {settings.addressLine || "Sem taxa de entrega"}
                  </span>
                </span>
              </label>
            </div>

            {type === "delivery" ? (
              <div className="grid gap-4 sm:grid-cols-6">
                <div className="sm:col-span-4">
                  <label className="label" htmlFor="addressStreet">
                    Rua
                  </label>
                  <input
                    id="addressStreet"
                    name="addressStreet"
                    className="input"
                    autoComplete="address-line1"
                    maxLength={120}
                    required
                  />
                  <FieldError
                    messages={
                      state.status === "error" ? state.fieldErrors?.["addressStreet"] : undefined
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="addressNumber">
                    Número
                  </label>
                  <input
                    id="addressNumber"
                    name="addressNumber"
                    className="input"
                    maxLength={20}
                    required
                  />
                  <FieldError
                    messages={
                      state.status === "error" ? state.fieldErrors?.["addressNumber"] : undefined
                    }
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="label" htmlFor="addressDistrict">
                    Bairro
                  </label>
                  <input
                    id="addressDistrict"
                    name="addressDistrict"
                    className="input"
                    maxLength={80}
                    required
                  />
                  <FieldError
                    messages={
                      state.status === "error" ? state.fieldErrors?.["addressDistrict"] : undefined
                    }
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="label" htmlFor="addressComplement">
                    Complemento
                  </label>
                  <input
                    id="addressComplement"
                    name="addressComplement"
                    className="input"
                    maxLength={80}
                    placeholder="Apto, bloco..."
                  />
                </div>
                <div className="sm:col-span-6">
                  <label className="label" htmlFor="addressReference">
                    Ponto de referência
                  </label>
                  <input
                    id="addressReference"
                    name="addressReference"
                    className="input"
                    maxLength={120}
                    placeholder="Opcional"
                  />
                </div>
              </div>
            ) : (
              <>
                <input type="hidden" name="addressStreet" value="" />
                <input type="hidden" name="addressNumber" value="" />
                <input type="hidden" name="addressComplement" value="" />
                <input type="hidden" name="addressDistrict" value="" />
                <input type="hidden" name="addressReference" value="" />
              </>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl">Pagamento</h2>

            {payments.length === 0 ? (
              <p role="alert" className="text-sm font-semibold text-terracotta">
                Nenhuma forma de pagamento disponível. Fale com o restaurante.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-3">
                {payments.map((method) => (
                  <label
                    key={method}
                    className="flex cursor-pointer items-center gap-2 rounded-xl border border-leather/20 p-3 text-sm"
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method}
                      checked={payment === method}
                      onChange={() => setPayment(method)}
                    />
                    <span className="font-semibold">{paymentMethodLabel(method)}</span>
                  </label>
                ))}
              </div>
            )}

            {payment === "cash" ? (
              <div>
                <label className="label" htmlFor="changeFor">
                  Troco para quanto? (opcional)
                </label>
                <input
                  id="changeFor"
                  name="changeFor"
                  className="input"
                  inputMode="decimal"
                  value={changeFor}
                  onChange={(event) => setChangeFor(event.target.value)}
                  placeholder="Ex.: 100,00"
                />
                <p className="mt-1 text-xs text-ink-soft">
                  Deixe em branco se não precisar de troco.
                </p>
                {changeError ? (
                  <p role="alert" className="mt-1 text-xs font-medium text-terracotta">
                    {changeError}
                  </p>
                ) : null}
                <FieldError
                  messages={state.status === "error" ? state.fieldErrors?.["changeFor"] : undefined}
                />
              </div>
            ) : (
              <input type="hidden" name="changeFor" value="" />
            )}
          </section>

          <section>
            <label className="label" htmlFor="notes">
              Observação do pedido
            </label>
            <textarea
              id="notes"
              name="notes"
              className="input min-h-20"
              maxLength={300}
              placeholder="Opcional: campainha, ponto de referência, talheres..."
            />
          </section>

          <button type="submit" className="btn btn-primary w-full" disabled={!canSubmit}>
            {pending ? "Enviando pedido…" : `Enviar pedido · ${formatBRL(total)}`}
          </button>

          {!openState.isOpen ? (
            <p className="text-center text-xs text-ink-soft">
              O envio fica disponível quando o restaurante reabrir.
            </p>
          ) : null}
        </form>

        <aside className="card space-y-4 p-5 lg:sticky lg:top-4">
          <h2 className="font-display text-xl">Resumo</h2>

          <ul className="space-y-3">
            {resolved.map((item) => (
              <li key={item.key} className="text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {item.line.quantity}× {item.productName}
                    </p>
                    {item.selections.length > 0 ? (
                      <p className="text-xs text-ink-soft">
                        {item.selections
                          .map((selection) => `${selection.groupName}: ${selection.optionName}`)
                          .join(" · ")}
                      </p>
                    ) : null}
                    {item.line.notes ? (
                      <p className="text-xs text-ink-soft">Obs.: {item.line.notes}</p>
                    ) : null}
                    {item.error ? (
                      <p role="alert" className="text-xs font-semibold text-terracotta">
                        {item.error}
                      </p>
                    ) : null}
                  </div>
                  <span className="whitespace-nowrap font-semibold">
                    {formatBRL(item.lineTotalCents)}
                  </span>
                </div>
                <button
                  type="button"
                  className="mt-1 text-xs font-semibold text-terracotta underline underline-offset-2"
                  onClick={() => removeLine(item.key)}
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>

          <dl className="space-y-1 border-t border-leather/10 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Subtotal</dt>
              <dd>{formatBRL(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Entrega</dt>
              <dd>{type === "delivery" ? formatBRL(deliveryFee) : "Retirada"}</dd>
            </div>
            <div className="flex justify-between border-t border-leather/10 pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd>{formatBRL(total)}</dd>
            </div>
          </dl>

          {belowMinimum ? (
            <p role="alert" className="text-xs font-semibold text-terracotta">
              O pedido mínimo é {formatBRL(settings.minOrderCents)}. Faltam{" "}
              {formatBRL(settings.minOrderCents - subtotal)}.
            </p>
          ) : null}

          {errors ? (
            <p role="alert" className="text-xs font-semibold text-terracotta">
              Remova os itens indisponíveis para continuar.
            </p>
          ) : null}

          <p className="text-xs text-ink-soft">
            O valor é conferido pelo restaurante no envio. Nenhum pagamento online é feito aqui.
          </p>
        </aside>
      </div>
    </main>
  );
}
