import { describe, expect, it } from "vitest";

import { settingsInputSchema } from "@/server/restaurant/settings-schema";

const valid = {
  phone: "(11) 99999-9999",
  addressLine: "Rua das Flores, 10 — Centro",
  deliveryFee: "5,00",
  deliveryEnabled: true,
  isManuallyClosed: false,
  closedMessage: "Estamos fechados agora.",
};

describe("settingsInputSchema", () => {
  it("converte a taxa em centavos", () => {
    const parsed = settingsInputSchema.parse(valid);
    expect(parsed.deliveryFee).toBe(500);
  });

  it("recusa taxa inválida", () => {
    const result = settingsInputSchema.safeParse({ ...valid, deliveryFee: "abc" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((issue) => issue.path.join("."));
      expect(fields).toContain("deliveryFee");
    }
  });

  it("recusa taxa de entrega abaixo de R$ 5,00 quando a entrega está ativa", () => {
    const result = settingsInputSchema.safeParse({ ...valid, deliveryFee: "4,99" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((issue) => issue.path.join("."));
      expect(fields).toContain("deliveryFee");
    }
  });

  it("aceita taxa abaixo do mínimo quando a entrega está desativada", () => {
    const parsed = settingsInputSchema.parse({
      ...valid,
      deliveryFee: "0,00",
      deliveryEnabled: false,
    });
    expect(parsed.deliveryFee).toBe(0);
  });

  it("recusa telefone curto", () => {
    expect(settingsInputSchema.safeParse({ ...valid, phone: "123" }).success).toBe(false);
  });

  it("recusa mensagem vazia", () => {
    expect(settingsInputSchema.safeParse({ ...valid, closedMessage: "   " }).success).toBe(false);
  });

  it("exige endereço", () => {
    expect(settingsInputSchema.safeParse({ ...valid, addressLine: "" }).success).toBe(false);
  });

  it("aceita valores no limite máximo permitido", () => {
    const parsed = settingsInputSchema.parse({ ...valid, deliveryFee: "1.000,00" });
    expect(parsed.deliveryFee).toBe(100_000);
  });

  it("recusa taxa acima do limite", () => {
    expect(settingsInputSchema.safeParse({ ...valid, deliveryFee: "1.000,01" }).success).toBe(false);
  });
});
