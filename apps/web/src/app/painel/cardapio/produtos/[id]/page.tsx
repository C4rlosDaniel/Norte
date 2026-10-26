import Link from "next/link";
import { notFound } from "next/navigation";

import { requireMember } from "@/server/auth/require-member";
import { getDb } from "@/server/db/client";
import { getMenuForPanel, listMenuCategoryOptions } from "@/server/menu/queries";

import { ModifierGroupsEditor } from "../../modifier-groups";
import { ProductForm } from "../../product-form";

export const metadata = { title: "Editar produto" };

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const member = await requireMember();
  const { id } = await params;
  const db = getDb();

  const [categories, menu] = await Promise.all([
    listMenuCategoryOptions(db, member.restaurantId),
    getMenuForPanel(db, member.restaurantId),
  ]);

  const category = menu.find((item) => item.products.some((product) => product.id === id));
  const product = category?.products.find((item) => item.id === id);

  if (!product) notFound();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href="/painel/cardapio" className="text-xs font-semibold underline underline-offset-2">
          ← Voltar ao cardápio
        </Link>
        <h1 className="font-display text-2xl">{product.name}</h1>
        <p className="text-sm text-ink-soft">
          Categoria: {category?.name ?? "—"} · {product.isAvailable ? "Disponível" : "Indisponível"}
        </p>
      </header>

      <ProductForm mode="edit" categories={categories} product={product} />

      <ModifierGroupsEditor productId={product.id} groups={product.modifierGroups} />
    </div>
  );
}
