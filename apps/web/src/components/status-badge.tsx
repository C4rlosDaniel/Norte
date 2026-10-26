import type { OpenState } from "@/server/restaurant/business-hours";

export function StatusBadge({ state }: { state: OpenState }) {
  if (state.isOpen) {
    return (
      <span className="badge badge-open">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-cactus" />
        Aberto{state.closesAtLabel ? ` até ${state.closesAtLabel}` : ""}
      </span>
    );
  }

  return (
    <span className="badge badge-closed">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-terracotta" />
      Fechado
    </span>
  );
}

export function closedReasonLabel(state: OpenState): string {
  switch (state.reason) {
    case "manual_closed":
      return "Fechado manualmente pelo painel";
    case "outside_hours":
      return state.nextOpenLabel
        ? `Fora do horário de funcionamento · abre ${state.nextOpenLabel}`
        : "Fora do horário de funcionamento";
    case "no_schedule":
      return "Nenhum horário de funcionamento cadastrado";
    case "open":
      return state.deliveryAllowed ? "Aceitando pedidos para entrega" : "Aceitando pedidos apenas para retirada";
  }
}
