import { describe, expect, it } from "vitest";

import type { MenuProduct } from "@/server/menu/queries";

import {
  cartItemCount,
  cartKey,
  cartSubtotal,
  hasCartErrors,
  mergeCartLine,
  resolveCart,
  resolveCartLine,
} from "@/components/menu/cart";

const now = new Date("2026-01-01T00:00:00.000Z");

function buildProduct(overrides: Partial<MenuProduct> = {}): MenuProduct {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    restaurantId: "22222222-2222-4222-8222-222222222222",
    categoryId: "33333333-3333-4333-8333-333333333333",
    name: "Picanha",
    description: "",
    priceCents: 4990,
    imageUrl: null,
    servesLabel: "",
    badge: "",
    tags: [],
    isAvailable: true,
    isFeatured: false,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    modifierGroups: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        productId: "11111111-1111-4111-8111-111111111111",
        name: "Ponto",
        minSelections: 1,
        maxSelections: 1,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
        options: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            groupId: "44444444-4444-4444-8444-444444444444",
            name: "Ao ponto",
            priceCents: 0,
            isAvailable: true,
            sortOrder: 0,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: "66666666-6666-4666-8666-666666666666",
            groupId: "44444444-4444-4444-8444-444444444444",
            name: "Bem passado",
            priceCents: 0,
            isAvailable: true,
            sortOrder: 1,
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
      {
        id: "77777777-7777-4777-8777-777777777777",
        productId: "11111111-1111-4111-8111-111111111111",
        name: "Adicionais",
        minSelections: 0,
        maxSelections: 2,
        sortOrder: 1,
        createdAt: now,
        updatedAt: now,
        options: [
          {
            id: "88888888-8888-4888-8888-888888888888",
            groupId: "77777777-7777-4777-8777-777777777777",
            name: "Ovo",
            priceCents: 300,
            isAvailable: true,
            sortOrder: 0,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: "99999999-9999-4999-8999-999999999999",
            groupId: "77777777-7777-4777-8777-777777777777",
            name: "Queijo",
            priceCents: 500,
            isAvailable: true,
            sortOrder: 1,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            groupId: "77777777-7777-4777-8777-777777777777",
            name: "Bacon",
            priceCents: 700,
            isAvailable: true,
            sortOrder: 2,
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("carrinho", () => {
  it("calcula o total com adicionais", () => {
    const product = buildProduct();
    const line = resolveCartLine(product, {
      productId: product.id,
      quantity: 2,
      optionIds: ["55555555-5555-4555-8555-555555555555", "88888888-8888-4888-8888-888888888888"],
      notes: "",
    });

    expect(line.error).toBeNull();
    expect(line.modifiersTotalCents).toBe(300);
    expect(line.unitPriceCents).toBe(5290);
    expect(line.lineTotalCents).toBe(10_580);
    expect(line.selections.map((selection) => selection.optionName)).toEqual(["Ao ponto", "Ovo"]);
  });

  it("exige grupo obrigatório", () => {
    const product = buildProduct();
    const line = resolveCartLine(product, {
      productId: product.id,
      quantity: 1,
      optionIds: [],
      notes: "",
    });

    expect(line.error).toContain("Ponto");
  });

  it("recusa adicional que não pertence ao produto", () => {
    const product = buildProduct();
    const line = resolveCartLine(product, {
      productId: product.id,
      quantity: 1,
      optionIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
      notes: "",
    });

    expect(line.error).toContain("saiu do cardápio");
  });

  it("recusa mais opções que o máximo", () => {
    const product = buildProduct();
    const line = resolveCartLine(product, {
      productId: product.id,
      quantity: 1,
      optionIds: [
        "55555555-5555-4555-8555-555555555555",
        "88888888-8888-4888-8888-888888888888",
        "99999999-9999-4999-8999-999999999999",
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      ],
      notes: "",
    });

    expect(line.error).toContain("Máximo de 2");
  });

  it("recusa adicional repetido", () => {
    const product = buildProduct();
    const line = resolveCartLine(product, {
      productId: product.id,
      quantity: 1,
      optionIds: [
        "55555555-5555-4555-8555-555555555555",
        "88888888-8888-4888-8888-888888888888",
        "88888888-8888-4888-8888-888888888888",
      ],
      notes: "",
    });

    expect(line.error).toContain("repetido");
  });

  it("marca produto indisponível", () => {
    const product = buildProduct({ isAvailable: false });
    const line = resolveCartLine(product, {
      productId: product.id,
      quantity: 1,
      optionIds: ["55555555-5555-4555-8555-555555555555"],
      notes: "",
    });

    expect(line.error).toContain("indisponível");
  });

  it("marca item que saiu do cardápio", () => {
    const [line] = resolveCart(new Map(), [
      {
        productId: "11111111-1111-4111-8111-111111111111",
        quantity: 1,
        optionIds: [],
        notes: "",
      },
    ]);

    expect(line?.error).toContain("saiu do cardápio");
  });

  it("junta linhas iguais e separa observações diferentes", () => {
    const base = {
      productId: "11111111-1111-4111-8111-111111111111",
      quantity: 1,
      optionIds: ["55555555-5555-4555-8555-555555555555"],
      notes: "",
    };

    const one = mergeCartLine([], base);
    const two = mergeCartLine(one, { ...base, quantity: 2 });
    expect(two).toHaveLength(1);
    expect(two[0]?.quantity).toBe(3);

    const three = mergeCartLine(two, { ...base, notes: "sem sal" });
    expect(three).toHaveLength(2);
    expect(three[1]?.notes).toBe("sem sal");
  });

  it("respeita o limite de 20 por linha", () => {
    const base = {
      productId: "11111111-1111-4111-8111-111111111111",
      quantity: 20,
      optionIds: [],
      notes: "",
    };

    const merged = mergeCartLine([base], { ...base, quantity: 5 });
    expect(merged[0]?.quantity).toBe(20);
  });

  it("soma subtotal, itens e erros", () => {
    const product = buildProduct();
    const resolved = resolveCart(new Map([[product.id, product]]), [
      {
        productId: product.id,
        quantity: 2,
        optionIds: ["55555555-5555-4555-8555-555555555555"],
        notes: "",
      },
    ]);

    expect(cartSubtotal(resolved)).toBe(9980);
    expect(cartItemCount([resolved[0]!.line])).toBe(2);
    expect(hasCartErrors(resolved)).toBe(false);
    expect(cartKey(product.id, ["b", "a"], "obs")).toBe(`${product.id}|a,b|obs`);
  });
});
