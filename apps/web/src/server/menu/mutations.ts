import { and, eq, ilike, ne } from "drizzle-orm";

import type { Db } from "@/server/db/types";
import {
  menuCategories,
  modifierGroups,
  modifierOptions,
  products,
} from "@/server/db/schema";
import type {
  CategoryInput,
  ModifierGroupInput,
  ModifierOptionInput,
  ProductInput,
} from "./schema";

export type MutationFailure = "not_found" | "duplicate_name" | "category_not_empty";

export type MutationResult = { ok: true; id?: string } | { ok: false; reason: MutationFailure };

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  if (code === "23505" || code === 23505) return true;
  return (
    error instanceof Error && /duplicate key|unique constraint/i.test(error.message)
  );
}

async function findOwnedCategory(
  db: Db,
  restaurantId: string,
  categoryId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: menuCategories.id })
    .from(menuCategories)
    .where(and(eq(menuCategories.id, categoryId), eq(menuCategories.restaurantId, restaurantId)))
    .limit(1);

  return row?.id ?? null;
}

async function findOwnedProduct(
  db: Db,
  restaurantId: string,
  productId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.restaurantId, restaurantId)))
    .limit(1);

  return row?.id ?? null;
}

async function findOwnedGroup(
  db: Db,
  restaurantId: string,
  groupId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: modifierGroups.id })
    .from(modifierGroups)
    .innerJoin(products, eq(products.id, modifierGroups.productId))
    .where(and(eq(modifierGroups.id, groupId), eq(products.restaurantId, restaurantId)))
    .limit(1);

  return row?.id ?? null;
}

async function findOwnedOption(
  db: Db,
  restaurantId: string,
  optionId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: modifierOptions.id })
    .from(modifierOptions)
    .innerJoin(modifierGroups, eq(modifierGroups.id, modifierOptions.groupId))
    .innerJoin(products, eq(products.id, modifierGroups.productId))
    .where(and(eq(modifierOptions.id, optionId), eq(products.restaurantId, restaurantId)))
    .limit(1);

  return row?.id ?? null;
}

export async function createCategory(
  db: Db,
  restaurantId: string,
  input: CategoryInput,
): Promise<MutationResult> {
  const [existing] = await db
    .select({ id: menuCategories.id })
    .from(menuCategories)
    .where(
      and(eq(menuCategories.restaurantId, restaurantId), ilike(menuCategories.name, input.name)),
    )
    .limit(1);

  if (existing) return { ok: false, reason: "duplicate_name" };

  try {
    await db.insert(menuCategories).values({
      restaurantId,
      name: input.name,
      description: input.description,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "duplicate_name" };
    throw error;
  }

  return { ok: true };
}

export async function updateCategory(
  db: Db,
  restaurantId: string,
  categoryId: string,
  input: CategoryInput,
): Promise<MutationResult> {
  const owned = await findOwnedCategory(db, restaurantId, categoryId);
  if (!owned) return { ok: false, reason: "not_found" };

  const [duplicate] = await db
    .select({ id: menuCategories.id })
    .from(menuCategories)
    .where(
      and(
        eq(menuCategories.restaurantId, restaurantId),
        ilike(menuCategories.name, input.name),
        ne(menuCategories.id, categoryId),
      ),
    )
    .limit(1);

  if (duplicate) return { ok: false, reason: "duplicate_name" };

  try {
    await db
      .update(menuCategories)
      .set({
        name: input.name,
        description: input.description,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
        updatedAt: new Date(),
      })
      .where(and(eq(menuCategories.id, categoryId), eq(menuCategories.restaurantId, restaurantId)));
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "duplicate_name" };
    throw error;
  }

  return { ok: true };
}

/** Categorias com produtos não podem ser apagadas (evita perda acidental). */
export async function deleteCategory(
  db: Db,
  restaurantId: string,
  categoryId: string,
): Promise<MutationResult> {
  const owned = await findOwnedCategory(db, restaurantId, categoryId);
  if (!owned) return { ok: false, reason: "not_found" };

  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.categoryId, categoryId))
    .limit(1);

  if (product) return { ok: false, reason: "category_not_empty" };

  await db
    .delete(menuCategories)
    .where(and(eq(menuCategories.id, categoryId), eq(menuCategories.restaurantId, restaurantId)));

  return { ok: true };
}

function productValues(input: ProductInput) {
  return {
    categoryId: input.categoryId,
    name: input.name,
    description: input.description,
    priceCents: input.price,
    servesLabel: input.servesLabel,
    badge: input.badge,
    isAvailable: input.isAvailable,
    isFeatured: input.isFeatured,
    sortOrder: input.sortOrder,
  };
}

export async function createProduct(
  db: Db,
  restaurantId: string,
  input: ProductInput,
): Promise<MutationResult> {
  const category = await findOwnedCategory(db, restaurantId, input.categoryId);
  if (!category) return { ok: false, reason: "not_found" };

  const [created] = await db
    .insert(products)
    .values({ restaurantId, ...productValues(input) })
    .returning({ id: products.id });

  return created ? { ok: true, id: created.id } : { ok: false, reason: "not_found" };
}

export async function updateProduct(
  db: Db,
  restaurantId: string,
  productId: string,
  input: ProductInput,
): Promise<MutationResult> {
  const category = await findOwnedCategory(db, restaurantId, input.categoryId);
  if (!category) return { ok: false, reason: "not_found" };

  const updated = await db
    .update(products)
    .set({ ...productValues(input), updatedAt: new Date() })
    .where(and(eq(products.id, productId), eq(products.restaurantId, restaurantId)))
    .returning({ id: products.id });

  return updated.length > 0 ? { ok: true, id: productId } : { ok: false, reason: "not_found" };
}

export async function deleteProduct(
  db: Db,
  restaurantId: string,
  productId: string,
): Promise<MutationResult> {
  const deleted = await db
    .delete(products)
    .where(and(eq(products.id, productId), eq(products.restaurantId, restaurantId)))
    .returning({ id: products.id });

  return deleted.length > 0 ? { ok: true } : { ok: false, reason: "not_found" };
}

export async function setProductAvailability(
  db: Db,
  restaurantId: string,
  productId: string,
  isAvailable: boolean,
): Promise<MutationResult> {
  const updated = await db
    .update(products)
    .set({ isAvailable, updatedAt: new Date() })
    .where(and(eq(products.id, productId), eq(products.restaurantId, restaurantId)))
    .returning({ id: products.id });

  return updated.length > 0 ? { ok: true } : { ok: false, reason: "not_found" };
}

export async function createModifierGroup(
  db: Db,
  restaurantId: string,
  productId: string,
  input: ModifierGroupInput,
): Promise<MutationResult> {
  const product = await findOwnedProduct(db, restaurantId, productId);
  if (!product) return { ok: false, reason: "not_found" };

  const [created] = await db
    .insert(modifierGroups)
    .values({
      productId,
      name: input.name,
      minSelections: input.minSelections,
      maxSelections: input.maxSelections,
      sortOrder: input.sortOrder,
    })
    .returning({ id: modifierGroups.id });

  return created ? { ok: true, id: created.id } : { ok: false, reason: "not_found" };
}

export async function updateModifierGroup(
  db: Db,
  restaurantId: string,
  groupId: string,
  input: ModifierGroupInput,
): Promise<MutationResult> {
  const owned = await findOwnedGroup(db, restaurantId, groupId);
  if (!owned) return { ok: false, reason: "not_found" };

  await db
    .update(modifierGroups)
    .set({
      name: input.name,
      minSelections: input.minSelections,
      maxSelections: input.maxSelections,
      sortOrder: input.sortOrder,
      updatedAt: new Date(),
    })
    .where(eq(modifierGroups.id, groupId));

  return { ok: true };
}

export async function deleteModifierGroup(
  db: Db,
  restaurantId: string,
  groupId: string,
): Promise<MutationResult> {
  const owned = await findOwnedGroup(db, restaurantId, groupId);
  if (!owned) return { ok: false, reason: "not_found" };

  await db.delete(modifierGroups).where(eq(modifierGroups.id, groupId));

  return { ok: true };
}

export async function createModifierOption(
  db: Db,
  restaurantId: string,
  groupId: string,
  input: ModifierOptionInput,
): Promise<MutationResult> {
  const group = await findOwnedGroup(db, restaurantId, groupId);
  if (!group) return { ok: false, reason: "not_found" };

  const [created] = await db
    .insert(modifierOptions)
    .values({
      groupId,
      name: input.name,
      priceCents: input.price,
      isAvailable: input.isAvailable,
      sortOrder: input.sortOrder,
    })
    .returning({ id: modifierOptions.id });

  return created ? { ok: true, id: created.id } : { ok: false, reason: "not_found" };
}

export async function updateModifierOption(
  db: Db,
  restaurantId: string,
  optionId: string,
  input: ModifierOptionInput,
): Promise<MutationResult> {
  const owned = await findOwnedOption(db, restaurantId, optionId);
  if (!owned) return { ok: false, reason: "not_found" };

  await db
    .update(modifierOptions)
    .set({
      name: input.name,
      priceCents: input.price,
      isAvailable: input.isAvailable,
      sortOrder: input.sortOrder,
      updatedAt: new Date(),
    })
    .where(eq(modifierOptions.id, optionId));

  return { ok: true };
}

export async function deleteModifierOption(
  db: Db,
  restaurantId: string,
  optionId: string,
): Promise<MutationResult> {
  const owned = await findOwnedOption(db, restaurantId, optionId);
  if (!owned) return { ok: false, reason: "not_found" };

  await db.delete(modifierOptions).where(eq(modifierOptions.id, optionId));

  return { ok: true };
}
