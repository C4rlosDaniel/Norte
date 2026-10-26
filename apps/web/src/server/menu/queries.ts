import { and, asc, eq, inArray } from "drizzle-orm";

import type { Db } from "@/server/db/types";
import {
  menuCategories,
  modifierGroups,
  modifierOptions,
  products,
  type MenuCategory,
  type ModifierGroup,
  type ModifierOption,
  type Product,
} from "@/server/db/schema";

export type MenuModifierGroup = ModifierGroup & { options: ModifierOption[] };
export type MenuProduct = Product & { modifierGroups: MenuModifierGroup[] };
export type MenuCategoryWithProducts = MenuCategory & { products: MenuProduct[] };

type LoadOptions = {
  activeCategoriesOnly: boolean;
  availableOptionsOnly: boolean;
  includeEmptyCategories: boolean;
};

/** Três consultas no total: categorias, produtos e adicionais. */
async function loadMenu(
  db: Db,
  restaurantId: string,
  options: LoadOptions,
): Promise<MenuCategoryWithProducts[]> {
  const categoryRows = await db
    .select()
    .from(menuCategories)
    .where(
      options.activeCategoriesOnly
        ? and(eq(menuCategories.restaurantId, restaurantId), eq(menuCategories.isActive, true))
        : eq(menuCategories.restaurantId, restaurantId),
    )
    .orderBy(asc(menuCategories.sortOrder), asc(menuCategories.name));

  if (categoryRows.length === 0) return [];

  const categoryIds = categoryRows.map((category) => category.id);

  const productRows = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.restaurantId, restaurantId),
        inArray(products.categoryId, categoryIds),
      ),
    )
    .orderBy(asc(products.sortOrder), asc(products.name));

  const productIds = productRows.map((product) => product.id);

  const groupRows =
    productIds.length > 0
      ? await db
          .select()
          .from(modifierGroups)
          .where(inArray(modifierGroups.productId, productIds))
          .orderBy(asc(modifierGroups.sortOrder), asc(modifierGroups.name))
      : [];

  const groupIds = groupRows.map((group) => group.id);

  const optionRows =
    groupIds.length > 0
      ? await db
          .select()
          .from(modifierOptions)
          .where(
            options.availableOptionsOnly
              ? and(
                  inArray(modifierOptions.groupId, groupIds),
                  eq(modifierOptions.isAvailable, true),
                )
              : inArray(modifierOptions.groupId, groupIds),
          )
          .orderBy(asc(modifierOptions.sortOrder), asc(modifierOptions.name))
      : [];

  const optionsByGroup = new Map<string, ModifierOption[]>();
  for (const option of optionRows) {
    const current = optionsByGroup.get(option.groupId) ?? [];
    current.push(option);
    optionsByGroup.set(option.groupId, current);
  }

  const groupsByProduct = new Map<string, MenuModifierGroup[]>();
  for (const group of groupRows) {
    const withOptions: MenuModifierGroup = {
      ...group,
      options: optionsByGroup.get(group.id) ?? [],
    };

    // No cardápio público, grupo sem opção disponível não aparece.
    if (options.availableOptionsOnly && withOptions.options.length === 0) continue;

    const current = groupsByProduct.get(group.productId) ?? [];
    current.push(withOptions);
    groupsByProduct.set(group.productId, current);
  }

  const productsByCategory = new Map<string, MenuProduct[]>();
  for (const product of productRows) {
    const current = productsByCategory.get(product.categoryId) ?? [];
    current.push({ ...product, modifierGroups: groupsByProduct.get(product.id) ?? [] });
    productsByCategory.set(product.categoryId, current);
  }

  return categoryRows
    .map((category) => ({
      ...category,
      products: productsByCategory.get(category.id) ?? [],
    }))
    .filter((category) => options.includeEmptyCategories || category.products.length > 0);
}

/** Painel: inclui categorias vazias e produtos/opções indisponíveis. */
export async function getMenuForPanel(
  db: Db,
  restaurantId: string,
): Promise<MenuCategoryWithProducts[]> {
  return loadMenu(db, restaurantId, {
    activeCategoriesOnly: false,
    availableOptionsOnly: false,
    includeEmptyCategories: true,
  });
}

export type PublicMenu = {
  categories: MenuCategoryWithProducts[];
  featured: MenuProduct[];
};

/** Cardápio público: só categorias ativas, sem categorias vazias. */
export async function getPublicMenu(db: Db, restaurantId: string): Promise<PublicMenu> {
  const categories = await loadMenu(db, restaurantId, {
    activeCategoriesOnly: true,
    availableOptionsOnly: true,
    includeEmptyCategories: false,
  });

  const featured = categories
    .flatMap((category) => category.products)
    .filter((product) => product.isFeatured);

  return { categories, featured };
}

export async function listMenuCategoryOptions(
  db: Db,
  restaurantId: string,
): Promise<Array<{ id: string; name: string; isActive: boolean }>> {
  return db
    .select({
      id: menuCategories.id,
      name: menuCategories.name,
      isActive: menuCategories.isActive,
    })
    .from(menuCategories)
    .where(eq(menuCategories.restaurantId, restaurantId))
    .orderBy(asc(menuCategories.sortOrder), asc(menuCategories.name));
}
