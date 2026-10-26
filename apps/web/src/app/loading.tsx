export default function Loading() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16" aria-busy="true">
      <div className="h-3 w-24 animate-pulse rounded bg-kraft-dark" />
      <div className="mt-4 h-9 w-3/4 animate-pulse rounded bg-kraft-dark" />
      <div className="card mt-6 space-y-3 p-6">
        <div className="h-4 w-1/2 animate-pulse rounded bg-kraft" />
        <div className="h-4 w-full animate-pulse rounded bg-kraft" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-kraft" />
      </div>
      <span className="sr-only">Carregando…</span>
    </main>
  );
}
