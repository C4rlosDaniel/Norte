import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

type SeedData = {
  categories: Array<{ key: string; name: string; sortOrder: number }>;
  products: Array<{
    key: string;
    categoryKey: string;
    name: string;
    priceCents: number;
    sortOrder: number;
    isFeatured: boolean;
    modifierGroups: Array<{
      name: string;
      minSelections: number;
      maxSelections: number;
      options: Array<{ name: string; priceCents: number }>;
    }>;
  }>;
};

const data = JSON.parse(
  readFileSync(new URL("../../scripts/data/menu.json", import.meta.url), "utf8"),
) as SeedData;

describe("dados do cardápio importados do protótipo", () => {
  it("tem 16 categorias e 108 produtos após mover 'Adicionais' para grupos", () => {
    expect(data.categories).toHaveLength(16);
    expect(data.products).toHaveLength(108);
  });

  it("não tem categoria 'Adicionais': os extras são grupos de modificadores", () => {
    expect(data.categories.some((category) => category.key === "adicionais")).toBe(false);

    const extrasGroups = data.products.flatMap((product) =>
      product.modifierGroups.filter((group) => group.name === "Adicionais"),
    );
    expect(extrasGroups.length).toBeGreaterThan(0);
    for (const group of extrasGroups) {
      expect(group.minSelections).toBe(0);
      expect(group.maxSelections).toBeGreaterThanOrEqual(3);
      expect(group.options.map((option) => option.name)).toEqual(
        expect.arrayContaining(["2 ovos", "Salada P", "Queijo Coalho (tira)"]),
      );
    }
  });

  it("não repete chaves nem nomes na mesma categoria", () => {
    expect(new Set(data.categories.map((category) => category.key)).size).toBe(
      data.categories.length,
    );

    const names = new Set<string>();
    for (const product of data.products) {
      const key = `${product.categoryKey}|${product.name}`;
      expect(names.has(key), `produto repetido: ${key}`).toBe(false);
      names.add(key);
    }
  });

  it("liga todo produto a uma categoria existente", () => {
    const categoryKeys = new Set(data.categories.map((category) => category.key));

    for (const product of data.products) {
      expect(categoryKeys.has(product.categoryKey), product.name).toBe(true);
    }
  });

  it("usa preços inteiros em centavos e ordens únicas por categoria", () => {
    const orders = new Set<string>();

    for (const product of data.products) {
      expect(Number.isInteger(product.priceCents), product.name).toBe(true);
      expect(product.priceCents, product.name).toBeGreaterThanOrEqual(0);
      expect(product.sortOrder).toBeGreaterThanOrEqual(0);

      const orderKey = `${product.categoryKey}|${product.sortOrder}`;
      expect(orders.has(orderKey), `ordem repetida: ${orderKey}`).toBe(false);
      orders.add(orderKey);
    }
  });

  it("mantém os grupos de adicionais coerentes", () => {
    for (const product of data.products) {
      for (const group of product.modifierGroups) {
        expect(group.minSelections, `${product.name} / ${group.name}`).toBeGreaterThanOrEqual(0);
        expect(group.maxSelections, `${product.name} / ${group.name}`).toBeGreaterThanOrEqual(1);
        expect(group.maxSelections, `${product.name} / ${group.name}`).toBeGreaterThanOrEqual(
          group.minSelections,
        );
        expect(group.options.length, `${product.name} / ${group.name}`).toBeGreaterThanOrEqual(
          group.maxSelections,
        );

        for (const option of group.options) {
          expect(Number.isInteger(option.priceCents), option.name).toBe(true);
          expect(option.priceCents).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("marca seis produtos como destaque (a antiga categoria 'mais pedidos')", () => {
    expect(data.products.filter((product) => product.isFeatured)).toHaveLength(6);
  });
});
