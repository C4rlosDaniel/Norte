"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireMember } from "@/server/auth/require-member";
import { getDb } from "@/server/db/client";
import { log } from "@/server/logger";
import {
  createCategory,
  createModifierGroup,
  createModifierOption,
  createProduct,
  deleteCategory,
  deleteModifierGroup,
  deleteModifierOption,
  deleteProduct,
  setProductAvailability,
  updateCategory,
  updateModifierGroup,
  updateModifierOption,
  updateProduct,
  type MutationFailure,
} from "@/server/menu/mutations";
import {
  categoryIdSchema,
  categoryInputSchema,
  modifierGroupIdSchema,
  modifierGroupInputSchema,
  modifierOptionIdSchema,
  modifierOptionInputSchema,
  productIdSchema,
  productInputSchema,
} from "@/server/menu/schema";

export type MenuFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

function invalid(error: z.ZodError, message = "Revise os campos destacados."): MenuFormState {
  return {
    status: "error",
    message,
    fieldErrors: z.flattenError(error).fieldErrors,
  };
}

function failure(reason: MutationFailure): MenuFormState {
  switch (reason) {
    case "duplicate_name":
      return { status: "error", message: "Já existe uma categoria com esse nome." };
    case "category_not_empty":
      return {
        status: "error",
        message: "Esta categoria ainda tem produtos. Mova ou exclua os produtos antes de removê-la.",
      };
    case "not_found":
      return {
        status: "error",
        message: "Registro não encontrado neste restaurante. Recarregue a página.",
      };
  }
}

function revalidateMenu(productId?: string): void {
  revalidatePath("/painel/cardapio");
  revalidatePath("/");
  if (productId) revalidatePath(`/painel/cardapio/produtos/${productId}`);
}

function internalError(event: string, error: unknown): MenuFormState {
  log("error", event, {
    errorName: error instanceof Error ? error.name : "unknown",
  });
  return { status: "error", message: "Não foi possível salvar. Tente novamente." };
}

export async function createCategoryAction(
  _previous: MenuFormState,
  formData: FormData,
): Promise<MenuFormState> {
  const member = await requireMember();

  const parsed = categoryInputSchema.safeParse({
    name: text(formData, "name"),
    description: text(formData, "description"),
    sortOrder: text(formData, "sortOrder") || "0",
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) return invalid(parsed.error);

  try {
    const result = await createCategory(getDb(), member.restaurantId, parsed.data);
    if (!result.ok) return failure(result.reason);
  } catch (error) {
    return internalError("menu.category_create_failed", error);
  }

  revalidateMenu();
  log("info", "menu.category_created", { restaurantId: member.restaurantId });
  return { status: "success", message: "Categoria criada." };
}

export async function updateCategoryAction(
  _previous: MenuFormState,
  formData: FormData,
): Promise<MenuFormState> {
  const member = await requireMember();

  const id = categoryIdSchema.safeParse(text(formData, "categoryId"));
  if (!id.success) return { status: "error", message: "Categoria inválida." };

  const parsed = categoryInputSchema.safeParse({
    name: text(formData, "name"),
    description: text(formData, "description"),
    sortOrder: text(formData, "sortOrder") || "0",
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) return invalid(parsed.error);

  try {
    const result = await updateCategory(getDb(), member.restaurantId, id.data, parsed.data);
    if (!result.ok) return failure(result.reason);
  } catch (error) {
    return internalError("menu.category_update_failed", error);
  }

  revalidateMenu();
  return { status: "success", message: "Categoria salva." };
}

export async function deleteCategoryAction(
  _previous: MenuFormState,
  formData: FormData,
): Promise<MenuFormState> {
  const member = await requireMember();

  const id = categoryIdSchema.safeParse(text(formData, "categoryId"));
  if (!id.success) return { status: "error", message: "Categoria inválida." };

  try {
    const result = await deleteCategory(getDb(), member.restaurantId, id.data);
    if (!result.ok) return failure(result.reason);
  } catch (error) {
    return internalError("menu.category_delete_failed", error);
  }

  revalidateMenu();
  log("info", "menu.category_deleted", { restaurantId: member.restaurantId });
  return { status: "success", message: "Categoria removida." };
}

export async function createProductAction(
  _previous: MenuFormState,
  formData: FormData,
): Promise<MenuFormState> {
  const member = await requireMember();

  const parsed = productInputSchema.safeParse({
    categoryId: text(formData, "categoryId"),
    name: text(formData, "name"),
    description: text(formData, "description"),
    price: text(formData, "price"),
    servesLabel: text(formData, "servesLabel"),
    badge: text(formData, "badge"),
    isAvailable: formData.get("isAvailable") === "on",
    isFeatured: formData.get("isFeatured") === "on",
    sortOrder: text(formData, "sortOrder") || "0",
  });

  if (!parsed.success) return invalid(parsed.error);

  let productId: string | undefined;

  try {
    const result = await createProduct(getDb(), member.restaurantId, parsed.data);
    if (!result.ok) return failure(result.reason);
    productId = result.id;
  } catch (error) {
    return internalError("menu.product_create_failed", error);
  }

  revalidateMenu(productId);
  log("info", "menu.product_created", { restaurantId: member.restaurantId });

  if (!productId) return { status: "error", message: "Não foi possível abrir o produto criado." };

  redirect(`/painel/cardapio/produtos/${productId}`);
}

export async function updateProductAction(
  _previous: MenuFormState,
  formData: FormData,
): Promise<MenuFormState> {
  const member = await requireMember();

  const id = productIdSchema.safeParse(text(formData, "productId"));
  if (!id.success) return { status: "error", message: "Produto inválido." };

  const parsed = productInputSchema.safeParse({
    categoryId: text(formData, "categoryId"),
    name: text(formData, "name"),
    description: text(formData, "description"),
    price: text(formData, "price"),
    servesLabel: text(formData, "servesLabel"),
    badge: text(formData, "badge"),
    isAvailable: formData.get("isAvailable") === "on",
    isFeatured: formData.get("isFeatured") === "on",
    sortOrder: text(formData, "sortOrder") || "0",
  });

  if (!parsed.success) return invalid(parsed.error);

  try {
    const result = await updateProduct(getDb(), member.restaurantId, id.data, parsed.data);
    if (!result.ok) return failure(result.reason);
  } catch (error) {
    return internalError("menu.product_update_failed", error);
  }

  revalidateMenu(id.data);
  return { status: "success", message: "Produto salvo." };
}

export async function deleteProductAction(
  _previous: MenuFormState,
  formData: FormData,
): Promise<MenuFormState> {
  const member = await requireMember();

  const id = productIdSchema.safeParse(text(formData, "productId"));
  if (!id.success) return { status: "error", message: "Produto inválido." };

  try {
    const result = await deleteProduct(getDb(), member.restaurantId, id.data);
    if (!result.ok) return failure(result.reason);
  } catch (error) {
    return internalError("menu.product_delete_failed", error);
  }

  revalidateMenu();
  log("info", "menu.product_deleted", { restaurantId: member.restaurantId });
  redirect("/painel/cardapio");
}

/** Ação simples (sem estado) para o botão de disponibilidade na listagem. */
export async function toggleProductAvailabilityAction(formData: FormData): Promise<void> {
  const member = await requireMember();

  const id = productIdSchema.safeParse(text(formData, "productId"));
  const isAvailable = text(formData, "isAvailable") === "true";
  if (!id.success) return;

  try {
    await setProductAvailability(getDb(), member.restaurantId, id.data, isAvailable);
  } catch (error) {
    log("error", "menu.product_availability_failed", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    throw error;
  }

  revalidateMenu(id.data);
}

export async function createModifierGroupAction(
  _previous: MenuFormState,
  formData: FormData,
): Promise<MenuFormState> {
  const member = await requireMember();

  const productId = productIdSchema.safeParse(text(formData, "productId"));
  if (!productId.success) return { status: "error", message: "Produto inválido." };

  const parsed = modifierGroupInputSchema.safeParse({
    name: text(formData, "name"),
    minSelections: text(formData, "minSelections") || "0",
    maxSelections: text(formData, "maxSelections") || "1",
    sortOrder: text(formData, "sortOrder") || "0",
  });

  if (!parsed.success) return invalid(parsed.error);

  try {
    const result = await createModifierGroup(
      getDb(),
      member.restaurantId,
      productId.data,
      parsed.data,
    );
    if (!result.ok) return failure(result.reason);
  } catch (error) {
    return internalError("menu.modifier_group_create_failed", error);
  }

  revalidateMenu(productId.data);
  return { status: "success", message: "Grupo de adicionais criado." };
}

export async function updateModifierGroupAction(
  _previous: MenuFormState,
  formData: FormData,
): Promise<MenuFormState> {
  const member = await requireMember();

  const groupId = modifierGroupIdSchema.safeParse(text(formData, "groupId"));
  const productId = productIdSchema.safeParse(text(formData, "productId"));
  if (!groupId.success || !productId.success) {
    return { status: "error", message: "Grupo inválido." };
  }

  const parsed = modifierGroupInputSchema.safeParse({
    name: text(formData, "name"),
    minSelections: text(formData, "minSelections") || "0",
    maxSelections: text(formData, "maxSelections") || "1",
    sortOrder: text(formData, "sortOrder") || "0",
  });

  if (!parsed.success) return invalid(parsed.error);

  try {
    const result = await updateModifierGroup(
      getDb(),
      member.restaurantId,
      groupId.data,
      parsed.data,
    );
    if (!result.ok) return failure(result.reason);
  } catch (error) {
    return internalError("menu.modifier_group_update_failed", error);
  }

  revalidateMenu(productId.data);
  return { status: "success", message: "Grupo atualizado." };
}

export async function deleteModifierGroupAction(
  _previous: MenuFormState,
  formData: FormData,
): Promise<MenuFormState> {
  const member = await requireMember();

  const groupId = modifierGroupIdSchema.safeParse(text(formData, "groupId"));
  const productId = productIdSchema.safeParse(text(formData, "productId"));
  if (!groupId.success || !productId.success) {
    return { status: "error", message: "Grupo inválido." };
  }

  try {
    const result = await deleteModifierGroup(getDb(), member.restaurantId, groupId.data);
    if (!result.ok) return failure(result.reason);
  } catch (error) {
    return internalError("menu.modifier_group_delete_failed", error);
  }

  revalidateMenu(productId.data);
  return { status: "success", message: "Grupo removido." };
}

export async function createModifierOptionAction(
  _previous: MenuFormState,
  formData: FormData,
): Promise<MenuFormState> {
  const member = await requireMember();

  const groupId = modifierGroupIdSchema.safeParse(text(formData, "groupId"));
  const productId = productIdSchema.safeParse(text(formData, "productId"));
  if (!groupId.success || !productId.success) {
    return { status: "error", message: "Grupo inválido." };
  }

  const parsed = modifierOptionInputSchema.safeParse({
    name: text(formData, "name"),
    price: text(formData, "price"),
    isAvailable: formData.get("isAvailable") === "on",
    sortOrder: text(formData, "sortOrder") || "0",
  });

  if (!parsed.success) return invalid(parsed.error);

  try {
    const result = await createModifierOption(
      getDb(),
      member.restaurantId,
      groupId.data,
      parsed.data,
    );
    if (!result.ok) return failure(result.reason);
  } catch (error) {
    return internalError("menu.modifier_option_create_failed", error);
  }

  revalidateMenu(productId.data);
  return { status: "success", message: "Adicional criado." };
}

export async function updateModifierOptionAction(
  _previous: MenuFormState,
  formData: FormData,
): Promise<MenuFormState> {
  const member = await requireMember();

  const optionId = modifierOptionIdSchema.safeParse(text(formData, "optionId"));
  const productId = productIdSchema.safeParse(text(formData, "productId"));
  if (!optionId.success || !productId.success) {
    return { status: "error", message: "Adicional inválido." };
  }

  const parsed = modifierOptionInputSchema.safeParse({
    name: text(formData, "name"),
    price: text(formData, "price"),
    isAvailable: formData.get("isAvailable") === "on",
    sortOrder: text(formData, "sortOrder") || "0",
  });

  if (!parsed.success) return invalid(parsed.error);

  try {
    const result = await updateModifierOption(
      getDb(),
      member.restaurantId,
      optionId.data,
      parsed.data,
    );
    if (!result.ok) return failure(result.reason);
  } catch (error) {
    return internalError("menu.modifier_option_update_failed", error);
  }

  revalidateMenu(productId.data);
  return { status: "success", message: "Adicional atualizado." };
}

export async function deleteModifierOptionAction(
  _previous: MenuFormState,
  formData: FormData,
): Promise<MenuFormState> {
  const member = await requireMember();

  const optionId = modifierOptionIdSchema.safeParse(text(formData, "optionId"));
  const productId = productIdSchema.safeParse(text(formData, "productId"));
  if (!optionId.success || !productId.success) {
    return { status: "error", message: "Adicional inválido." };
  }

  try {
    const result = await deleteModifierOption(getDb(), member.restaurantId, optionId.data);
    if (!result.ok) return failure(result.reason);
  } catch (error) {
    return internalError("menu.modifier_option_delete_failed", error);
  }

  revalidateMenu(productId.data);
  return { status: "success", message: "Adicional removido." };
}
