import Link from "next/link";

import { AutoRefresh } from "@/components/auto-refresh";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { formatDateTime } from "@/lib/datetime";
import { requireMember } from "@/server/auth/require-member";
import { getDb } from "@/server/db/client";
import type { OrderStatus } from "@/server/db/schema";
import { formatBRL } from "@/server/money";
import {
  countOrdersByStatus,
  listOrdersForPanel,
} from "@/server/orders/queries";
import { orderTypeLabel, paymentMethodLabel } from "@/server/orders/status";

export const metadata = { title: "Pedidos" };

export const dynamic = "force-dynamic";

const FILTERS: Array<{ key: string; label: string; statuses?: OrderStatus[] }> = [
  { key: "todos", label: "Todos" },
  { key: "novos", label: "Novos", statuses: ["pending"] },
  {
    key: "andamento",
    label: "Em andamento",
    statuses: ["confirmed", "preparing", "ready", "out_for_delivery"],
  },
  { key: "finalizados", label: "Finalizados", statuses: ["delivered", "canceled"] },
];

function pickFilter(value: string | undefined) {
  return FILTERS.find((filter) => filter.key === value) ?? FILTERS[0]!;
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const member = await requireMember();
  const db = getDb();
  const params = await searchParams;
  const filter = pickFilter(params.filtro);

  const [orders, counts] = await Promise.all([
    listOrdersForPanel(db, member.restaurantId, { statuses: filter.statuses }),
    countOrdersByStatus(db, member.restaurantId),
  ]);

  const activeCount =
    counts.confirmed + counts.preparing + counts.ready + counts.out_for_delivery;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-2xl">Pedidos</h1>
          <p className="text-sm text-ink-soft">
            {counts.pending} {counts.pending === 1 ? "novo" : "novos"} · {activeCount} em andamento
          </p>
        </div>
        <AutoRefresh intervalMs={10_000} />
      </header>

      <nav aria-label="Filtros de pedidos" className="flex flex-wrap gap-2 text-sm">
        {FILTERS.map((item) => {
          const isCurrent = item.key === filter.key;
          return (
            <Link
              key={item.key}
              href={item.key === "todos" ? "/painel/pedidos" : `/painel/pedidos?filtro=${item.key}`}
              className={`rounded-full border px-3 py-1 font-semibold ${
                isCurrent
                  ? "border-leather bg-leather text-paper"
                  : "border-leather/20 bg-paper text-leather"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {orders.length === 0 ? (
        <section className="card flex flex-col items-center gap-2 px-6 py-14 text-center">
          <p className="font-semibold">
            {filter.key === "todos" ? "Nenhum pedido ainda" : `Nenhum pedido em "${filter.label}"`}
          </p>
          <p className="max-w-sm text-sm text-ink-soft">
            {filter.key === "todos"
              ? "Os pedidos enviados pelo cardápio aparecem aqui automaticamente."
              : "Troque o filtro para ver os outros pedidos."}
          </p>
        </section>
      ) : (
        <ul className="space-y-2">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/painel/pedidos/${order.id}`}
                className={`card block p-4 transition-colors hover:bg-paper ${
                  order.status === "pending" ? "border-terracotta/40" : ""
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-lg">
                        #{String(order.orderNumber).padStart(4, "0")}
                      </span>
                      <OrderStatusBadge status={order.status} type={order.type} />
                      {order.status === "pending" ? (
                        <span className="text-xs font-semibold text-terracotta">Aguardando aceite</span>
                      ) : null}
                    </div>
                    <p className="truncate text-sm font-medium">{order.customerName}</p>
                    <p className="text-xs text-ink-soft">
                      {formatDateTime(order.createdAt, member.restaurantTimezone)} ·{" "}
                      {orderTypeLabel(order.type)} · {paymentMethodLabel(order.paymentMethod)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-semibold">{formatBRL(order.totalCents)}</p>
                    <p className="text-xs text-ink-soft">
                      {order.notes ? "Com observação" : "\u00a0"}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
