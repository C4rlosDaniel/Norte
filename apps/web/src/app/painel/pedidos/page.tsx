export const metadata = { title: "Pedidos" };

export default function OrdersPage() {
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="font-display text-2xl">Pedidos</h1>
        <p className="text-sm text-ink-soft">
          A lista de pedidos em tempo real, detalhes, mudança de status, reimpressão e o aviso
          &quot;saiu para entrega&quot; entram na Fase 3.
        </p>
      </header>

      <section className="card flex flex-col items-center gap-2 px-6 py-14 text-center">
        <p className="font-semibold">Nenhum pedido ainda</p>
        <p className="max-w-sm text-sm text-ink-soft">
          Quando o checkout estiver ativo, os pedidos aparecem aqui automaticamente. Nada nesta tela
          é simulado: não há botões que fingem executar ações.
        </p>
      </section>
    </div>
  );
}
