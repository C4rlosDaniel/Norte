export const metadata = { title: "Cardápio" };

export default function MenuAdminPage() {
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="font-display text-2xl">Cardápio</h1>
        <p className="text-sm text-ink-soft">
          Cadastro de categorias, produtos, adicionais e disponibilidade entra na Fase 2.
        </p>
      </header>

      <section className="card flex flex-col items-center gap-2 px-6 py-14 text-center">
        <p className="font-semibold">Cadastro ainda não disponível</p>
        <p className="max-w-sm text-sm text-ink-soft">
          O modelo de dados do cardápio já está definido em{" "}
          <code className="font-mono text-xs">docs/02-modelo-de-dados.md</code>. Esta tela será
          construída na próxima fase, junto com o cardápio público.
        </p>
      </section>
    </div>
  );
}
