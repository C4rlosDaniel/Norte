import { describe, expect, it } from "vitest";

import {
  categoryInputSchema,
  modifierGroupInputSchema,
  modifierOptionInputSchema,
  productInputSchema,
} from "@/server/menu/schema";

const categoryId = "11111111-1111-4111-8111-111111111111";

const product = {
  categoryId,
  name: "Baião de Dois",
  description: "Arroz, feijão de corda e carne seca.",
  price: "26,99",
  servesLabel: "Serve 1",
  badge: "Mais pedido",
  isAvailable: true,
  isFeatured: false,
  sortOrder: "2",
};

describe("categoryInputSchema", () => {
  it("normaliza nome, ordem e descrição", () => {
    const parsed = categoryInputSchema.parse({
      name: "  Porções  ",
      description: "  Para dividir  ",
      sortOrder: "3",
      isActive: true,
    });

    expect(parsed).toEqual({
      name: "Porções",
      description: "Para dividir",
      sortOrder: 3,
      isActive: true,
    });
  });

  it("recusa nome curto", () => {
    const result = categoryInputSchema.safeParse({
      name: "A",
      description: "",
      sortOrder: "0",
      isActive: true,
    });

    expect(result.success).toBe(false);
  });

  it("recusa ordem negativa", () => {
    const result = categoryInputSchema.safeParse({
      name: "Bebidas",
      description: "",
      sortOrder: "-1",
      isActive: true,
    });

    expect(result.success).toBe(false);
  });
});

describe("productInputSchema", () => {
  it("converte o preço em centavos", () => {
    const parsed = productInputSchema.parse(product);
    expect(parsed.price).toBe(2699);
    expect(parsed.sortOrder).toBe(2);
  });

  it("aceita campos opcionais vazios", () => {
    const parsed = productInputSchema.parse({
      ...product,
      description: "",
      servesLabel: "",
      badge: "",
    });

    expect(parsed.servesLabel).toBe("");
    expect(parsed.badge).toBe("");
  });

  it("recusa preço vazio ou inválido", () => {
    const empty = productInputSchema.safeParse({ ...product, price: "" });
    const invalid = productInputSchema.safeParse({ ...product, price: "abc" });

    expect(empty.success).toBe(false);
    expect(invalid.success).toBe(false);
  });

  it("recusa categoria que não é uuid", () => {
    const result = productInputSchema.safeParse({ ...product, categoryId: "bebidas" });
    expect(result.success).toBe(false);
  });

  it("recusa preço acima do limite", () => {
    const result = productInputSchema.safeParse({ ...product, price: "100.000,01" });
    expect(result.success).toBe(false);
  });
});

describe("modifierGroupInputSchema", () => {
  it("aceita grupo obrigatório com quantidade exata", () => {
    const parsed = modifierGroupInputSchema.parse({
      name: "Escolha 3 opções",
      minSelections: "3",
      maxSelections: "3",
      sortOrder: "0",
    });

    expect(parsed.minSelections).toBe(3);
    expect(parsed.maxSelections).toBe(3);
  });

  it("recusa máximo menor que o mínimo", () => {
    const result = modifierGroupInputSchema.safeParse({
      name: "Adicionais",
      minSelections: "2",
      maxSelections: "1",
      sortOrder: "0",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join("."))).toContain("maxSelections");
    }
  });

  it("recusa máximo zero", () => {
    const result = modifierGroupInputSchema.safeParse({
      name: "Adicionais",
      minSelections: "0",
      maxSelections: "0",
      sortOrder: "0",
    });

    expect(result.success).toBe(false);
  });
});

describe("modifierOptionInputSchema", () => {
  it("trata preço vazio como zero", () => {
    const parsed = modifierOptionInputSchema.parse({
      name: "Sem alcaparras",
      price: "",
      isAvailable: true,
      sortOrder: "0",
    });

    expect(parsed.price).toBe(0);
  });

  it("converte preço com vírgula", () => {
    const parsed = modifierOptionInputSchema.parse({
      name: "Torresminho",
      price: "15,00",
      isAvailable: true,
      sortOrder: "1",
    });

    expect(parsed.price).toBe(1500);
  });

  it("recusa adicional sem nome", () => {
    const result = modifierOptionInputSchema.safeParse({
      name: "  ",
      price: "0",
      isAvailable: true,
      sortOrder: "0",
    });

    expect(result.success).toBe(false);
  });
});
