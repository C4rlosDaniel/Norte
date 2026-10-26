import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  menuCategories,
  modifierGroups,
  modifierOptions,
  products,
  restaurants,
} from "@/server/db/schema";
import {
  createCategory,
  createModifierGroup,
  createModifierOption,
  createProduct,
  deleteCategory,
  deleteModifierGroup,
  deleteProduct,
  setProductAvailability,
  updateCategory,
  updateModifierGroup,
  updateModifierOption,
  updateProduct,
} from "@/server/menu/mutations";
import { getMenuForPanel, getPublicMenu } from "@/server/menu/queries";
import {
  categoryInputSchema,
  modifierGroupInputSchema,
  modifierOptionInputSchema,
  productInputSchema,
} from "@/server/menu/schema";
import { createTestDatabase, type TestDatabase } from "./helpers/database";

let ctx: TestDatabase;

beforeEach(async () => {
  ctx = await createTestDatabase();
});

afterEach(async () => {
  await ctx.client.close();
});

function category(name: string, sortOrder = 0) {
  return categoryInputSchema.parse({
    name,
    description: "",
    sortOrder: String(sortOrder),
    isActive: true,
  });
}

function product(
  categoryId: string,
  overrides: {
    name?: string;
    price?: string;
    sortOrder?: string;
    isFeatured?: boolean;
    isAvailable?: boolean;
  } = {},
) {
  return productInputSchema.parse({
    categoryId,
    name: overrides.name ?? "Baião de Dois",
    description: "Arroz, feijão de corda e carne seca.",
    price: overrides.price ?? "26,99",
    servesLabel: "Serve 1",
    badge: "",
    isAvailable: overrides.isAvailable ?? true,
    isFeatured: overrides.isFeatured ?? false,
    sortOrder: overrides.sortOrder ?? "0",
  });
}

function group(name = "Adicionais", minSelections = "0", maxSelections = "3") {
  return modifierGroupInputSchema.parse({
    name,
    minSelections,
    maxSelections,
    sortOrder: "0",
  });
}

function option(name: string, price = "0", isAvailable = true) {
  return modifierOptionInputSchema.parse({
    name,
    price,
    isAvailable,
    sortOrder: "0",
  });
}

async function seedRestaurant(slug: string) {
  const [restaurant] = await ctx.db
    .insert(restaurants)
    .values({ slug, name: `Restaurante ${slug}` })
    .returning();

  if (!restaurant) throw new Error("restaurante de teste não criado");
  return restaurant;
}

async function seedCategoryAndProduct(restaurantId: string) {
  await createCategory(ctx.db, restaurantId, category("Pratos"));
  const [row] = await ctx.db
    .select()
    .from(menuCategories)
    .where(eq(menuCategories.restaurantId, restaurantId))
    .limit(1);

  if (!row) throw new Error("categoria de teste não criada");

  const result = await createProduct(ctx.db, restaurantId, product(row.id));
  if (!result.ok || !result.id) throw new Error("produto de teste não criado");

  return { category: row, productId: result.id };
}

describe("categorias do cardápio", () => {
  it("cria, recusa nome repetido (sem diferenciar maiúsculas) e atualiza", async () => {
    const restaurant = await seedRestaurant("a");

    expect(await createCategory(ctx.db, restaurant.id, category("Porções"))).toEqual({
      ok: true,
    });

    expect(await createCategory(ctx.db, restaurant.id, category("porções"))).toEqual({
      ok: false,
      reason: "duplicate_name",
    });

    const [row] = await ctx.db.select().from(menuCategories).limit(1);
    if (!row) throw new Error("categoria não encontrada");

    expect(await updateCategory(ctx.db, restaurant.id, row.id, category("Porções quentes"))).toEqual(
      { ok: true },
    );

    const [updated] = await ctx.db.select().from(menuCategories).limit(1);
    expect(updated?.name).toBe("Porções quentes");
  });

  it("não exclui categoria com produtos; exclui depois de remover os produtos", async () => {
    const restaurant = await seedRestaurant("a");
    const { category: createdCategory, productId } = await seedCategoryAndProduct(restaurant.id);

    expect(await deleteCategory(ctx.db, restaurant.id, createdCategory.id)).toEqual({
      ok: false,
      reason: "category_not_empty",
    });

    expect(await deleteProduct(ctx.db, restaurant.id, productId)).toEqual({ ok: true });
    expect(await deleteCategory(ctx.db, restaurant.id, createdCategory.id)).toEqual({ ok: true });

    const rows = await ctx.db.select().from(menuCategories);
    expect(rows).toHaveLength(0);
  });
});

describe("produtos do cardápio", () => {
  it("atualiza preço e disponibilidade", async () => {
    const restaurant = await seedRestaurant("a");
    const { category: createdCategory, productId } = await seedCategoryAndProduct(restaurant.id);

    expect(
      await updateProduct(ctx.db, restaurant.id, productId, product(createdCategory.id, {
        name: "Baião médio",
        price: "54,99",
      })),
    ).toEqual({ ok: true, id: productId });

    expect(
      await setProductAvailability(ctx.db, restaurant.id, productId, false),
    ).toEqual({ ok: true });

    const [row] = await ctx.db.select().from(products).limit(1);
    expect(row?.name).toBe("Baião médio");
    expect(row?.priceCents).toBe(5499);
    expect(row?.isAvailable).toBe(false);
  });

  it("isola restaurantes: um restaurante não altera nem apaga produto de outro", async () => {
    const first = await seedRestaurant("a");
    const second = await seedRestaurant("b");
    const { category: firstCategory, productId } = await seedCategoryAndProduct(first.id);

    expect(
      await createProduct(ctx.db, second.id, product(firstCategory.id, { name: "Invasor" })),
    ).toEqual({ ok: false, reason: "not_found" });

    expect(
      await updateProduct(ctx.db, second.id, productId, product(firstCategory.id)),
    ).toEqual({ ok: false, reason: "not_found" });

    expect(await setProductAvailability(ctx.db, second.id, productId, false)).toEqual({
      ok: false,
      reason: "not_found",
    });

    expect(await deleteProduct(ctx.db, second.id, productId)).toEqual({
      ok: false,
      reason: "not_found",
    });

    const rows = await ctx.db.select().from(products).where(eq(products.id, productId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.isAvailable).toBe(true);
  });
});

describe("adicionais", () => {
  it("cria, atualiza e remove grupo com opções em cascata", async () => {
    const restaurant = await seedRestaurant("a");
    const { productId } = await seedCategoryAndProduct(restaurant.id);

    const createdGroup = await createModifierGroup(ctx.db, restaurant.id, productId, group());
    if (!createdGroup.ok || !createdGroup.id) throw new Error("grupo não criado");

    const createdOption = await createModifierOption(
      ctx.db,
      restaurant.id,
      createdGroup.id,
      option("Torresminho", "15,00"),
    );
    if (!createdOption.ok || !createdOption.id) throw new Error("opção não criada");

    expect(
      await updateModifierGroup(ctx.db, restaurant.id, createdGroup.id, group("Extras", "1", "2")),
    ).toEqual({ ok: true });

    expect(
      await updateModifierOption(
        ctx.db,
        restaurant.id,
        createdOption.id,
        option("Torresminho especial", "18,50", false),
      ),
    ).toEqual({ ok: true });

    const [savedGroup] = await ctx.db
      .select()
      .from(modifierGroups)
      .where(eq(modifierGroups.id, createdGroup.id));
    const [savedOption] = await ctx.db
      .select()
      .from(modifierOptions)
      .where(eq(modifierOptions.id, createdOption.id));

    expect(savedGroup?.minSelections).toBe(1);
    expect(savedGroup?.maxSelections).toBe(2);
    expect(savedOption?.priceCents).toBe(1850);
    expect(savedOption?.isAvailable).toBe(false);

    expect(await deleteModifierGroup(ctx.db, restaurant.id, createdGroup.id)).toEqual({ ok: true });

    const groups = await ctx.db.select().from(modifierGroups);
    const options = await ctx.db.select().from(modifierOptions);
    expect(groups).toHaveLength(0);
    expect(options).toHaveLength(0);
  });

  it("remove grupos e opções em cascata ao excluir o produto", async () => {
    const restaurant = await seedRestaurant("a");
    const { productId } = await seedCategoryAndProduct(restaurant.id);

    const createdGroup = await createModifierGroup(ctx.db, restaurant.id, productId, group());
    if (!createdGroup.ok || !createdGroup.id) throw new Error("grupo não criado");

    await createModifierOption(
      ctx.db,
      restaurant.id,
      createdGroup.id,
      option("Farofa", "5,00"),
    );

    expect(await deleteProduct(ctx.db, restaurant.id, productId)).toEqual({ ok: true });

    expect(await ctx.db.select().from(modifierGroups)).toHaveLength(0);
    expect(await ctx.db.select().from(modifierOptions)).toHaveLength(0);
  });
});

describe("consultas do cardápio", () => {
  it("painel vê tudo; público oculta categoria inativa/vazia e opção indisponível", async () => {
    const restaurant = await seedRestaurant("a");

    await createCategory(ctx.db, restaurant.id, category("Pratos", 0));
    await createCategory(ctx.db, restaurant.id, category("Inativa", 2));
    await createCategory(ctx.db, restaurant.id, category("Vazia", 3));

    const rows = await ctx.db
      .select()
      .from(menuCategories)
      .where(eq(menuCategories.restaurantId, restaurant.id));
    const pratos = rows.find((row) => row.name === "Pratos");
    const inativa = rows.find((row) => row.name === "Inativa");
    if (!pratos || !inativa) throw new Error("categorias não criadas");

    // A categoria "Inativa" começa ativa (helper) e é desativada na sequência.
    await ctx.db
      .update(menuCategories)
      .set({ isActive: false })
      .where(eq(menuCategories.id, inativa.id));

    await createCategory(ctx.db, restaurant.id, category("Bebidas", 1));

    const createdProduct = await createProduct(
      ctx.db,
      restaurant.id,
      product(pratos.id, { name: "Prato do dia", isAvailable: false, isFeatured: true }),
    );
    if (!createdProduct.ok || !createdProduct.id) throw new Error("produto não criado");

    await createProduct(
      ctx.db,
      restaurant.id,
      product(inativa.id, { name: "Escondido" }),
    );

    const bebidas = (await ctx.db
      .select()
      .from(menuCategories)
      .where(eq(menuCategories.restaurantId, restaurant.id))).find(
      (row) => row.name === "Bebidas",
    );
    if (!bebidas) throw new Error("categoria Bebidas não criada");

    const drink = await createProduct(
      ctx.db,
      restaurant.id,
      product(bebidas.id, { name: "Suco", isFeatured: true }),
    );
    if (!drink.ok || !drink.id) throw new Error("bebida não criada");

    const createdGroup = await createModifierGroup(
      ctx.db,
      restaurant.id,
      drink.id,
      group("Gelo"),
    );
    if (!createdGroup.ok || !createdGroup.id) throw new Error("grupo não criado");

    await createModifierOption(ctx.db, restaurant.id, createdGroup.id, option("Com gelo"));
    await createModifierOption(
      ctx.db,
      restaurant.id,
      createdGroup.id,
      option("Sem gelo", "0", false),
    );

    const publicMenu = await getPublicMenu(ctx.db, restaurant.id);
    expect(publicMenu.categories.map((row) => row.name)).toEqual(["Pratos", "Bebidas"]);

    const publicDrink = publicMenu.categories[1]?.products[0];
    expect(publicDrink?.name).toBe("Suco");
    expect(publicDrink?.modifierGroups[0]?.options.map((row) => row.name)).toEqual(["Com gelo"]);

    expect(publicMenu.featured.map((row) => row.name).sort()).toEqual(["Prato do dia", "Suco"]);

    const publicDish = publicMenu.categories[0]?.products[0];
    expect(publicDish?.name).toBe("Prato do dia");
    expect(publicDish?.isAvailable).toBe(false);

    const panelMenu = await getMenuForPanel(ctx.db, restaurant.id);
    expect(panelMenu.map((row) => row.name)).toEqual(["Pratos", "Bebidas", "Inativa", "Vazia"]);

    const panelDrink = panelMenu
      .find((row) => row.name === "Bebidas")
      ?.products.find((row) => row.name === "Suco");
    expect(panelDrink?.modifierGroups[0]?.options).toHaveLength(2);
  });
});

describe("constraints do banco", () => {
  it("impede preço negativo e grupo com máximo menor que o mínimo", async () => {
    const restaurant = await seedRestaurant("a");
    const { category: createdCategory, productId } = await seedCategoryAndProduct(restaurant.id);

    await expect(
      ctx.db.update(products).set({ priceCents: -1 }).where(eq(products.id, productId)),
    ).rejects.toThrow();

    await expect(
      ctx.db.insert(modifierGroups).values({
        productId,
        name: "Inválido",
        minSelections: 2,
        maxSelections: 1,
      }),
    ).rejects.toThrow();

    expect(createdCategory.id).toBeTruthy();
  });
});
