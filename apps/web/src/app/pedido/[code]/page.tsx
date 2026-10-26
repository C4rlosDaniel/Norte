import Link from "next/link";
import { notFound } from "next/navigation";

import { AutoRefresh } from "@/components/auto-refresh";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { formatDateTime } from "@/lib/datetime";
import { getDb } from "@/server/db/client";
import { formatBRL } from "@/server/money";
import { formatAddress } from "@/server/orders/schema";
import {
  orderStatusLabel,
  orderTypeLabel,
  paymentMethodLabel,
} from "@/server/orders/status";
import { getOrderByLinkCode } from "@/server/orders/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: { absolute: "Acompanhar pedido" } };

function maskPhone(digits: string): string {
  if (digits.length < 4) return "—";
  return `final ${digits.slice(-4)}`;
}

export default async function PublicOrderPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const detail = await getOrderByLinkCode(getDb(), code);

  if (!detail) notFound();

  const { order, items, events, restaurant } = detail;
  const orderLabel = `#${String(order.orderNumber).padStart(4, "0")}`;
  const isActive = order.status !== "delivered" && order.status !== "canceled";
  const address = formatAddress(order);
  const change =
    order.paymentMethod === "cash" && order.changeForCents !== null
      ? order.changeForCents - order.totalCents
      : null;

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-terracotta">
          {restaurant.name}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl">Pedido {orderLabel}</h1>
          <OrderStatusBadge status={order.status} type={order.type} />
        </div>
        <p className="text-sm text-ink-soft">
          Feito em {formatDateTime(order.createdAt, restaurant.timezone)} ·{" "}
          {orderTypeLabel(order.type)}
        </p>
        {isActive ? (
          <div className="flex items-center gap-2">
            <span className="badge badge-open">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-cactus" />
              Acompanhando
            </span>
            <AutoRefresh intervalMs={15_000} />
          </div>
        ) : null}
      </header>

      <section className="card space-y-3 p-5">
        <h2 className="font-display text-xl">Itens</h2>
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="border-b border-leather/10 pb-3 last:border-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {item.quantity}× {item.productName}
                  </p>
                  {item.modifiers.length > 0 ? (
                    <p className="text-xs text-ink-soft">
                      {item.modifiers
                        .map((modifier) => `${modifier.groupName}: ${modifier.optionName}`)
                        .join(" · ")}
                    </p>
                  ) : null}
                  {item.notes ? (
                    <p className="text-xs text-ink-soft">Obs.: {item.notes}</p>
                  ) : null}
                </div>
                <span className="whitespace-nowrap font-semibold">
                  {formatBRL(item.lineTotalCents)}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <dl className="space-y-1 border-t border-leather/10 pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-soft">Subtotal</dt>
            <dd>{formatBRL(order.subtotalCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-soft">Entrega</dt>
            <dd>
              {order.type === "delivery" ? formatBRL(order.deliveryFeeCents) : "Retirada"}
            </dd>
          </div>
          <div className="flex justify-between border-t border-leather/10 pt-2 text-base font-bold">
            <dt>Total</dt>
            <dd>{formatBRL(order.totalCents)}</dd>
          </div>
        </dl>
      </section>

      <section className="card grid gap-4 p-5 text-sm sm:grid-cols-2">
        <div>
          <h2 className="font-display text-xl">Entrega</h2>
          {order.type === "delivery" ? (
            <p className="mt-1 text-ink-soft">{address || "Endereço não informado"}</p>
          ) : (
            <p className="mt-1 text-ink-soft">
              Retirada em {restaurant.addressLine || "restaurante"}
            </p>
          )}
          <p className="mt-2">
            <span className="text-ink-soft">Cliente: </span>
            {order.customerName}
          </p>
          <p>
            <span className="text-ink-soft">Telefone: </span>
            {maskPhone(order.customerPhone)}
          </p>
        </div>

        <div>
          <h2 className="font-display text-xl">Pagamento</h2>
          <p className="mt-1">
            <span className="text-ink-soft">Forma: </span>
            {paymentMethodLabel(order.paymentMethod)}
          </p>
          {order.paymentMethod === "cash" ? (
            <p>
              <span className="text-ink-soft">Troco: </span>
              {order.changeForCents === null
                ? "não precisa"
                : `para ${formatBRL(order.changeForCents)}${change && change > 0 ? ` (${formatBRL(change)})` : ""}`}
            </p>
          ) : null}
          {order.notes ? (
            <p className="mt-2">
              <span className="text-ink-soft">Observação: </span>
              {order.notes}
            </p>
          ) : null}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-display text-xl">Histórico</h2>
        <ol className="mt-3 space-y-3">
          {events.map((event) => (
            <li key={event.id} className="border-l-2 border-leather/20 pl-3">
              <p className="text-sm font-semibold">
                {orderStatusLabel(event.status, order.type)}
              </p>
              <p className="text-xs text-ink-soft">
                {formatDateTime(event.createdAt, restaurant.timezone)} · {event.note}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="card space-y-3 p-5 text-sm">
        <p className="text-ink-soft">
          Guarde este link para acompanhar o pedido. Ele não aparece em buscas e é exclusivo deste
          pedido.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/cardapio/${restaurant.slug}`} className="btn btn-primary">
            Fazer outro pedido
          </Link>
          {restaurant.phone ? (
            <a
              href={`tel:${restaurant.phone.replace(/\D/g, "")}`}
              className="btn btn-secondary"
            >
              Falar com o restaurante
            </a>
          ) : null}
        </div>
        <p className="text-xs text-ink-soft">{restaurant.addressLine}</p>
      </section>
    </main>
  );
}
