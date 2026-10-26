import { readFileSync } from "node:fs";

import { eq } from "drizzle-orm";

import type { Db } from "@/server/db/types";
import {
  menuCategories,
  modifierGroups,
  modifierOptions,
  products,
} from "@/server/db/schema";

type SeedModifierOption = {
  name: string;
  priceCents: number;
};

type SeedModifierGroup = {
  name: string;
  minSelections: number;
  maxSelections: number;
  options: SeedModifierOption[];
};

type SeedProduct = {
  key: string;
  categoryKey: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string | null;
  servesLabel: string;
  badge: string;
  tags: string[];
  isAvailable: boolean;
  isFeatured: boolean;
  sortOrder: number;
  modifierGroups: SeedModifierGroup[];
};

type SeedMenuData = {
  source: string;
  categories: Array<{ key: string; name: string; sortOrder: number }>;
  products: SeedProduct[];
};

/**
 * Importa o cardápio do protótipo. Só roda quando o restaurante ainda não tem
 * categorias, para nunca sobrescrever o que foi editado no painel.
 * `reset: true` (SEED_RESET_MENU=1) apaga o cardápio antes — apenas em dev.
 */
export async function seedMenu(
  db: Db,
  restaurantId: string,
  options: { reset?: boolean } = {},
): Promise<{ skipped: boolean; categories: number; products: number }> {
  const data = JSON.parse(
    readFileSync(new URL("./data/menu.json", import.meta.url), "utf8"),
  ) as SeedMenuData;

  const [existing] = await db
    .select({ id: menuCategories.id })
    .from(menuCategories)
    .where(eq(menuCategories.restaurantId, restaurantId))
    .limit(1);

  if (existing) {
    if (!options.reset) {
      console.log("[seed] cardápio já cadastrado; não sobrescrevo.");
      return { skipped: true, categories: 0, products: 0 };
    }

    await db.delete(menuCategories).where(eq(menuCategories.restaurantId, restaurantId));
    console.log("[seed] cardápio anterior apagado (SEED_RESET_MENU=1).");
  }

  await db.transaction(async (tx) => {
    const insertedCategories = await tx
      .insert(menuCategories)
      .values(
        data.categories.map((category) => ({
          restaurantId,
          name: category.name,
          sortOrder: category.sortOrder,
          isActive: true,
        })),
      )
      .returning({ id: menuCategories.id, name: menuCategories.name });

    const categoryIdByName = new Map(
      insertedCategories.map((category) => [category.name, category.id]),
    );

    const categoryIdByKey = new Map<string, string>();
    for (const category of data.categories) {
      const id = categoryIdByName.get(category.name);
      if (!id) throw new Error(`Categoria não inserida: ${category.name}`);
      categoryIdByKey.set(category.key, id);
    }

    const insertedProducts = await tx
      .insert(products)
      .values(
        data.products.map((product) => {
          const categoryId = categoryIdByKey.get(product.categoryKey);
          if (!categoryId) throw new Error(`Categoria ausente para ${product.name}`);

          return {
            restaurantId,
            categoryId,
            name: product.name,
            description: product.description,
            priceCents: product.priceCents,
            imageUrl: product.imageUrl,
            servesLabel: product.servesLabel,
            badge: product.badge,
            tags: product.tags,
            isAvailable: product.isAvailable,
            isFeatured: product.isFeatured,
            sortOrder: product.sortOrder,
          };
        }),
      )
      .returning({
        id: products.id,
        categoryId: products.categoryId,
        sortOrder: products.sortOrder,
      });

    const productIdByCategoryAndOrder = new Map(
      insertedProducts.map((product) => [
        `${product.categoryId}|${product.sortOrder}`,
        product.id,
      ]),
    );

    const productIdByKey = new Map<string, string>();
    for (const product of data.products) {
      const categoryId = categoryIdByKey.get(product.categoryKey);
      const id = categoryId
        ? productIdByCategoryAndOrder.get(`${categoryId}|${product.sortOrder}`)
        : undefined;
      if (!id) throw new Error(`Produto não inserido: ${product.name}`);
      productIdByKey.set(product.key, id);
    }

    const groupRows = data.products.flatMap((product) => {
      const productId = productIdByKey.get(product.key);
      if (!productId) throw new Error(`Produto ausente para grupo: ${product.name}`);

      return product.modifierGroups.map((group, index) => ({
        productId,
        name: group.name,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        sortOrder: index,
      }));
    });

    if (groupRows.length === 0) return;

    const insertedGroups = await tx
      .insert(modifierGroups)
      .values(groupRows)
      .returning({
        id: modifierGroups.id,
        productId: modifierGroups.productId,
        sortOrder: modifierGroups.sortOrder,
      });

    const groupIdByProductAndOrder = new Map(
      insertedGroups.map((group) => [`${group.productId}|${group.sortOrder}`, group.id]),
    );

    const optionRows = data.products.flatMap((product) => {
      const productId = productIdByKey.get(product.key);
      if (!productId) throw new Error(`Produto ausente para adicional: ${product.name}`);

      return product.modifierGroups.flatMap((group, groupIndex) => {
        const groupId = groupIdByProductAndOrder.get(`${productId}|${groupIndex}`);
        if (!groupId) throw new Error(`Grupo não inserido: ${group.name}`);

        return group.options.map((option, optionIndex) => ({
          groupId,
          name: option.name,
          priceCents: option.priceCents,
          isAvailable: true,
          sortOrder: optionIndex,
        }));
      });
    });

    if (optionRows.length > 0) {
      await tx.insert(modifierOptions).values(optionRows);
    }
  });

  console.log(
    `[seed] cardápio importado do protótipo: ${data.categories.length} categorias, ${data.products.length} produtos.`,
  );

  return { skipped: false, categories: data.categories.length, products: data.products.length };
}
