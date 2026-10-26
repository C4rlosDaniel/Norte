import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { AutoRefresh } from "@/components/auto-refresh";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { formatDateTime } from "@/lib/datetime";
import { requireMember } from "@/server/auth/require-member";
import { getDb } from "@/server/db/client";
import type { OrderStatus, OrderType, PrintJob, WhatsAppTask } from "@/server/db/schema";
import { formatBRL } from "@/server/money";
import { getOrderForPanel } from "@/server/orders/queries";
import { formatAddress } from "@/server/orders/schema";
import {
  nextOrderStatuses,
  orderStatusLabel,
  orderTypeLabel,
  paymentMethodLabel,
} from "@/server/orders/status";

import { updateOrderStatusAction } from "../actions";

export const metadata = { title: "Detalhe do pedido" };

export const dynamic = "force-dynamic";

const printStatusLabel: Record<PrintJob["status"], string> = {
  pending: "Aguardando impressão",
  processing: "Imprimindo",
  printed: "Impresso",
  failed: "Falhou",
  canceled: "Cancelado",
};

const whatsappStatusLabel: Record<WhatsAppTask["status"], string> = {
  pending: "Aguardando envio",
  sent: "Enviado",
  failed: "Falhou",
  skipped: "Não enviado",
};

function statusTone(status: string): string {
  if (status === "printed" || status === "sent") return "bg-cactus/20 text-cactus";
  if (status === "failed") return "bg-terracotta/15 text-terracotta";
  if (status === "canceled" || status === "skipped") return "bg-leather/10 text-ink-soft";
  return "bg-sun/30 text-leather";
}

function actionLabel(status: OrderStatus, type: OrderType): string {
  switch (status) {
    case "confirmed":
      return "Aceitar pedido";
    case "preparing":
      return "Iniciar preparo";
    case "ready":
      return "Marcar como pronto";
    case "out_for_delivery":
      return "Saiu para entrega";
    case "delivered":
      return type === "pickup" ? "Marcar como retirado" : "Marcar como entregue";
    case "canceled":
      return "Cancelar pedido";
    case "pending":
      return "Reabrir pedido";
  }
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const member = await requireMember();
  const { id } = await params;
  const query = await searchParams;

  if (!z.string().uuid().safeParse(id).success) notFound();

  const detail = await getOrderForPanel(getDb(), member.restaurantId, id);
  if (!detail) notFound();

  const { order, items, events, printJobs, whatsappTasks } = detail;
  const orderLabel = `#${String(order.orderNumber).padStart(4, "0")}`;
  const availableActions = nextOrderStatuses(order.status, order.type);
  const cancelAction = availableActions.includes("canceled");
  const otherActions = availableActions.filter((status) => status !== "canceled");
  const address = formatAddress(order);
  const change =
    order.paymentMethod === "cash" && order.changeForCents !== null
      ? order.changeForCents - order.totalCents
      : null;

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <Link
          href="/painel/pedidos"
          className="text-xs font-semibold text-ink-soft underline underline-offset-2"
        >
          ← Todos os pedidos
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl">Pedido {orderLabel}</h1>
            <OrderStatusBadge status={order.status} type={order.type} />
          </div>
          <AutoRefresh intervalMs={10_000} />
        </div>

        <p className="text-sm text-ink-soft">
          {formatDateTime(order.createdAt, member.restaurantTimezone)} ·{" "}
          {orderTypeLabel(order.type)}
        </p>
      </header>

      {query.ok ? (
        <p
          role="status"
          className="rounded-xl border border-cactus/30 bg-cactus/10 px-4 py-3 text-sm font-semibold text-cactus"
        >
          Status atualizado.
        </p>
      ) : null}

      {query.erro ? (
        <p
          role="alert"
          className="rounded-xl border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm font-semibold text-terracotta"
        >
          {query.erro}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="space-y-4">
          <section className="card space-y-3 p-5">
            <h2 className="font-display text-xl">Itens</h2>
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="border-b border-leather/10 pb-3 last:border-0 last:pb-0"
                >
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
                      <p className="text-xs text-ink-soft">
                        Unitário {formatBRL(item.unitPriceCents)}
                        {item.modifiersTotalCents > 0
                          ? ` + adicionais ${formatBRL(item.modifiersTotalCents)}`
                          : ""}
                      </p>
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

          <section className="card space-y-3 p-5 text-sm">
            <h2 className="font-display text-xl">Cliente e entrega</h2>
            <p>
              <span className="text-ink-soft">Nome: </span>
              {order.customerName}
            </p>
            <p>
              <span className="text-ink-soft">Telefone: </span>
              <a
                className="font-semibold underline underline-offset-2"
                href={`tel:${order.customerPhone}`}
              >
                {order.customerPhone}
              </a>
            </p>
            <p>
              <span className="text-ink-soft">
                {order.type === "delivery" ? "Endereço: " : "Retirada: "}
              </span>
              {order.type === "delivery"
                ? address || "Não informado"
                : member.restaurantName}
            </p>
            <p>
              <span className="text-ink-soft">Pagamento: </span>
              {paymentMethodLabel(order.paymentMethod)}
              {order.paymentMethod === "cash" ? (
                <>
                  {" · "}
                  {order.changeForCents === null
                    ? "sem troco"
                    : `troco para ${formatBRL(order.changeForCents)}${
                        change !== null && change > 0 ? ` (${formatBRL(change)})` : ""
                      }`}
                </>
              ) : null}
            </p>
            {order.notes ? (
              <p>
                <span className="text-ink-soft">Observação: </span>
                {order.notes}
              </p>
            ) : null}
            {order.status === "canceled" && order.cancelReason ? (
              <p>
                <span className="text-ink-soft">Motivo do cancelamento: </span>
                {order.cancelReason}
              </p>
            ) : null}
          </section>

          <section className="card space-y-3 p-5">
            <h2 className="font-display text-xl">Histórico</h2>
            <ol className="space-y-3">
              {events.map((event) => (
                <li key={event.id} className="border-l-2 border-leather/20 pl-3">
                  <p className="text-sm font-semibold">
                    {orderStatusLabel(event.status, order.type)}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {formatDateTime(event.createdAt, member.restaurantTimezone)} ·{" "}
                    {event.actorUserId ? "Equipe" : "Sistema/cliente"} · {event.note}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card space-y-2 p-5">
            <h2 className="font-display text-xl">Ações</h2>

            {availableActions.length === 0 ? (
              <p className="text-sm text-ink-soft">
                Pedido finalizado. Não há mais mudanças de status.
              </p>
            ) : null}

            {otherActions.map((status, index) => (
              <form key={status} action={updateOrderStatusAction}>
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="status" value={status} />
                <button
                  type="submit"
                  className={`btn w-full ${index === 0 ? "btn-primary" : "btn-secondary"}`}
                >
                  {actionLabel(status, order.type)}
                </button>
              </form>
            ))}

            {cancelAction ? (
              <details className="pt-1">
                <summary className="cursor-pointer text-sm font-semibold text-terracotta">
                  Cancelar pedido
                </summary>
                <form action={updateOrderStatusAction} className="mt-2 space-y-2">
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="status" value="canceled" />
                  <label className="label text-xs" htmlFor="cancel-reason">
                    Motivo (opcional)
                  </label>
                  <input
                    id="cancel-reason"
                    name="reason"
                    className="input"
                    maxLength={300}
                    placeholder="Ex.: cliente pediu para cancelar"
                  />
                  <button type="submit" className="btn btn-secondary w-full text-terracotta">
                    Confirmar cancelamento
                  </button>
                  <p className="text-xs text-ink-soft">
                    A impressão pendente e a confirmação de WhatsApp não serão processadas.
                  </p>
                </form>
              </details>
            ) : null}

            <Link
              href={`/pedido/${order.linkCode}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold underline underline-offset-2"
            >
              Ver página do cliente
            </Link>
          </section>

          <section className="card space-y-2 p-5 text-sm">
            <h2 className="font-display text-xl">Impressão</h2>
            {printJobs.length === 0 ? (
              <p className="text-ink-soft">Nenhum trabalho de impressão.</p>
            ) : (
              printJobs.map((job) => (
                <div key={job.id} className="space-y-1">
                  <span className={`badge ${statusTone(job.status)}`}>
                    {printStatusLabel[job.status]}
                  </span>
                  <p className="text-xs text-ink-soft">
                    Tentativas: {job.attempts}
                    {job.lastError ? ` · ${job.lastError}` : ""}
                  </p>
                </div>
              ))
            )}
            <p className="text-xs text-ink-soft">
              O agente local consome a fila na Fase 4. O cupom já está gravado neste pedido.
            </p>
          </section>

          <section className="card space-y-2 p-5 text-sm">
            <h2 className="font-display text-xl">WhatsApp</h2>
            {whatsappTasks.length === 0 ? (
              <p className="text-ink-soft">Nenhuma tarefa de WhatsApp.</p>
            ) : (
              whatsappTasks.map((task) => (
                <div key={task.id} className="space-y-1">
                  <span className={`badge ${statusTone(task.status)}`}>
                    {whatsappStatusLabel[task.status]}
                  </span>
                  <p className="text-xs text-ink-soft">
                    Confirmação do pedido · tentativas: {task.attempts}
                    {task.lastError ? ` · ${task.lastError}` : ""}
                  </p>
                </div>
              ))
            )}
            <p className="text-xs text-ink-soft">
              O envio pela API oficial entra na Fase 5. A tarefa já foi registrada na mesma
              transação do pedido.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
