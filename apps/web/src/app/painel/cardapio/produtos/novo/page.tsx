import Link from "next/link";

import { requireMember } from "@/server/auth/require-member";
import { getDb } from "@/server/db/client";
import { listMenuCategoryOptions } from "@/server/menu/queries";

import { ProductForm } from "../../product-form";

export const metadata = { title: "Novo produto" };

export const dynamic = "force-dynamic";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string | string[] | undefined }>;
}) {
  const member = await requireMember();
  const categories = await listMenuCategoryOptions(getDb(), member.restaurantId);
  const params = await searchParams;

  const requested = typeof params.categoria === "string" ? params.categoria : undefined;
  const defaultCategoryId = categories.some((category) => category.id === requested)
    ? requested
    : undefined;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href="/painel/cardapio" className="text-xs font-semibold underline underline-offset-2">
          ← Voltar ao cardápio
        </Link>
        <h1 className="font-display text-2xl">Novo produto</h1>
        <p className="text-sm text-ink-soft">
          O produto só aparece no cardápio público se estiver disponível e a categoria estiver
          ativa.
        </p>
      </header>

      {categories.length === 0 ? (
        <section className="card flex flex-col items-center gap-2 px-6 py-14 text-center">
          <p className="font-semibold">Crie uma categoria primeiro</p>
          <p className="max-w-sm text-sm text-ink-soft">
            Todo produto pertence a uma categoria. Volte ao cardápio e crie a primeira.
          </p>
          <Link href="/painel/cardapio" className="btn btn-primary mt-2 text-xs">
            Ir para o cardápio
          </Link>
        </section>
      ) : (
        <ProductForm
          mode="create"
          categories={categories}
          defaultCategoryId={defaultCategoryId}
        />
      )}
    </div>
  );
}
