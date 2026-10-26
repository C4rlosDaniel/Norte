"use client";

import Link from "next/link";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6 py-16">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-terracotta">Erro</p>
      <h1 className="font-display text-3xl">Não foi possível carregar o cardápio</h1>
      <p className="text-sm text-ink-soft">
        Pode ser uma instabilidade momentânea ou configuração incompleta no servidor. Tente de novo
        em alguns segundos.
      </p>
      <div className="flex gap-3">
        <button type="button" onClick={() => reset()} className="btn btn-primary">
          Tentar novamente
        </button>
        <Link href="/" className="btn btn-secondary">
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
