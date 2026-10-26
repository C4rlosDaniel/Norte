import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6 py-16">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-terracotta">404</p>
      <h1 className="font-display text-3xl">Página não encontrada</h1>
      <p className="text-sm text-ink-soft">O endereço acessado não existe neste site.</p>
      <Link href="/" className="btn btn-primary w-fit">
        Voltar ao início
      </Link>
    </main>
  );
}
