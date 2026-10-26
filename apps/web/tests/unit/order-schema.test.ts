import { describe, expect, it } from "vitest";

import {
  checkoutInputSchema,
  formatAddress,
  formatPhone,
  normalizePhone,
} from "@/server/orders/schema";

const productId = "6f6a1f2e-6d1d-4f9c-9f6e-2c3d4b5a6e7f";
const idempotencyKey = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";

function baseInput() {
  return {
    items: [{ productId, quantity: 1, optionIds: [], notes: "" }],
    type: "delivery" as const,
    customerName: "Maria Silva",
    customerPhone: "(11) 99999-9999",
    addressStreet: "Rua das Flores",
    addressNumber: "10",
    addressComplement: "Apto 2",
    addressDistrict: "Centro",
    addressReference: "Portão azul",
    paymentMethod: "cash" as const,
    changeFor: "150,00",
    notes: "Tocar a campainha",
    idempotencyKey,
  };
}

describe("telefone do pedido", () => {
  it("normaliza máscara e +55 para só dígitos", () => {
    expect(normalizePhone("(11) 99999-9999")).toBe("11999999999");
    expect(normalizePhone("+55 (11) 99999-9999")).toBe("11999999999");
    expect(normalizePhone("11 3333-4444")).toBe("1133334444");
  });

  it("formata para leitura", () => {
    expect(formatPhone("11999999999")).toBe("(11) 99999-9999");
    expect(formatPhone("1133334444")).toBe("(11) 3333-4444");
  });

  it("recusa telefone sem DDD", () => {
    const result = checkoutInputSchema.safeParse({ ...baseInput(), customerPhone: "123" });
    expect(result.success).toBe(false);
  });
});

describe("checkoutInputSchema", () => {
  it("converte troco para centavos e preserva dados", () => {
    const parsed = checkoutInputSchema.parse(baseInput());
    expect(parsed.customerPhone).toBe("11999999999");
    expect(parsed.changeFor).toBe(15_000);
    expect(parsed.items).toHaveLength(1);
  });

  it("aceita retirada sem endereço", () => {
    const parsed = checkoutInputSchema.parse({
      ...baseInput(),
      type: "pickup",
      addressStreet: "",
      addressNumber: "",
      addressDistrict: "",
    });
    expect(parsed.type).toBe("pickup");
  });

  it("exige endereço na entrega", () => {
    const result = checkoutInputSchema.safeParse({
      ...baseInput(),
      addressStreet: "",
      addressNumber: "",
      addressDistrict: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((issue) => issue.path.join("."));
      expect(fields).toContain("addressStreet");
      expect(fields).toContain("addressNumber");
      expect(fields).toContain("addressDistrict");
    }
  });

  it("recusa troco fora de dinheiro", () => {
    const result = checkoutInputSchema.safeParse({
      ...baseInput(),
      paymentMethod: "pix",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("changeFor"))).toBe(true);
    }
  });

  it("trata troco zero como sem troco", () => {
    const parsed = checkoutInputSchema.parse({ ...baseInput(), changeFor: "0,00" });
    expect(parsed.changeFor).toBeNull();
  });

  it("recusa carrinho vazio", () => {
    expect(checkoutInputSchema.safeParse({ ...baseInput(), items: [] }).success).toBe(false);
  });

  it("recusa quantidade acima do limite", () => {
    const input = baseInput();
    input.items[0]!.quantity = 21;
    expect(checkoutInputSchema.safeParse(input).success).toBe(false);
  });

  it("recusa idempotencyKey inválida", () => {
    expect(
      checkoutInputSchema.safeParse({ ...baseInput(), idempotencyKey: "abc" }).success,
    ).toBe(false);
  });
});

describe("formatAddress", () => {
  it("monta o endereço completo", () => {
    expect(
      formatAddress({
        addressStreet: "Rua das Flores",
        addressNumber: "10",
        addressComplement: "Apto 2",
        addressDistrict: "Centro",
        addressReference: "Portão azul",
      }),
    ).toBe("Rua das Flores, 10 · Apto 2 · Centro · Ref.: Portão azul");
  });

  it("não deixa separadores vazios", () => {
    expect(
      formatAddress({
        addressStreet: "Rua A",
        addressNumber: "1",
        addressComplement: "",
        addressDistrict: "",
        addressReference: "",
      }),
    ).toBe("Rua A, 1");
  });
});
