import Link from "next/link";

import { requireMember } from "@/server/auth/require-member";
import { getDb } from "@/server/db/client";
import { getMenuForPanel } from "@/server/menu/queries";

import { CategoryCard } from "./category-card";
import { CategoryCreateForm } from "./category-create-form";

export const metadata = { title: "Cardápio" };

export const dynamic = "force-dynamic";

export default async function MenuAdminPage() {
  const member = await requireMember();
  const categories = await getMenuForPanel(getDb(), member.restaurantId);
  const totalProducts = categories.reduce((total, category) => total + category.products.length, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-2xl">Cardápio</h1>
          <p className="text-sm text-ink-soft">
            {categories.length} {categories.length === 1 ? "categoria" : "categorias"} ·{" "}
            {totalProducts} {totalProducts === 1 ? "produto" : "produtos"}
          </p>
        </div>

        <Link
          href={`/cardapio/${member.restaurantSlug}`}
          target="_blank"
          rel="noreferrer"
          className="btn btn-secondary text-xs"
        >
          Ver cardápio público
        </Link>
      </header>

      <CategoryCreateForm />

      {categories.length === 0 ? (
        <section className="card flex flex-col items-center gap-2 px-6 py-14 text-center">
          <p className="font-semibold">Nenhuma categoria cadastrada</p>
          <p className="max-w-sm text-sm text-ink-soft">
            Crie a primeira categoria acima ou rode <code className="font-mono text-xs">npm run
            db:seed</code> para importar o cardápio de demonstração.
          </p>
        </section>
      ) : (
        <div className="space-y-4">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      )}
    </div>
  );
}
