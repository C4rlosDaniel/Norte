import { redirect } from "next/navigation";

import { getSessionUser } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; next?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();

  // Sessão válida sem vínculo com restaurante não pode entrar no painel
  // (evita laço de redirecionamento).
  if (user && params.erro !== "sem-acesso") {
    redirect("/painel");
  }

  const nextPath =
    params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-terracotta">Painel</p>
        <h1 className="font-display text-3xl">Entrar</h1>
        <p className="text-sm text-ink-soft">
          Acesso restrito à equipe do restaurante. Não existe cadastro público.
        </p>
      </header>

      {params.erro === "sem-acesso" ? (
        <p
          role="alert"
          className="rounded-lg border border-terracotta/40 bg-terracotta/10 px-3 py-2 text-sm font-medium text-terracotta"
        >
          Esta conta não tem acesso ao painel. Peça ao administrador para liberar o acesso.
        </p>
      ) : null}

      <LoginForm nextPath={nextPath} />

      <p className="text-xs text-ink-soft">
        Esqueceu a senha? A recuperação será adicionada junto com as configurações de e-mail.
      </p>
    </main>
  );
}
