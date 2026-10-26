import { describe, expect, it } from "vitest";

import { centsToInputValue, formatBRL, parseBRLToCents } from "@/server/money";

describe("parseBRLToCents", () => {
  it.each([
    ["12,50", 1250],
    ["R$ 12,50", 1250],
    ["12.50", 1250],
    ["R$ 1.234,56", 123456],
    ["1.234", 123400],
    ["0,09", 9],
    ["0", 0],
  ])("converte %s em %i centavos", (input, expected) => {
    expect(parseBRLToCents(input)).toBe(expected);
  });

  it.each([[""], ["   "], ["abc"], ["-5"], ["1,2,3"]])("rejeita %s", (input) => {
    expect(parseBRLToCents(input)).toBeNull();
  });
});

describe("formatBRL", () => {
  it("formata centavos como moeda brasileira com espaço normal", () => {
    expect(formatBRL(500)).toBe("R$ 5,00");
    expect(formatBRL(123456)).toBe("R$ 1.234,56");
  });

  it("usa travessão para valores inválidos", () => {
    expect(formatBRL(Number.NaN)).toBe("—");
  });
});

describe("centsToInputValue", () => {
  it("devolve valor com vírgula para o formulário", () => {
    expect(centsToInputValue(500)).toBe("5,00");
    expect(centsToInputValue(123456)).toBe("1234,56");
  });
});
