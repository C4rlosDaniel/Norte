import type { OrderStatus, OrderType } from "@/server/db/schema";
import { orderStatusBadgeClass, orderStatusLabel } from "@/server/orders/status";

export function OrderStatusBadge({
  status,
  type,
}: {
  status: OrderStatus;
  type?: OrderType;
}) {
  return <span className={`badge ${orderStatusBadgeClass(status)}`}>{orderStatusLabel(status, type)}</span>;
}
