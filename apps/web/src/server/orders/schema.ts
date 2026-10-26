import { z } from "zod";

import { parseBRLToCents } from "@/server/money";

const MAX_MONEY_CENTS = 10_000_000;
const MAX_ITEMS = 50;
const MAX_QUANTITY = 20;

/** Só dígitos. Aceita máscara, +55 e espaços; rejeita fixo sem DDD. */
export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  return digits;
}

/** (11) 99999-9999 */
export function formatPhone(digits: string): string {
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

const optionalMoneyField = z
  .string()
  .trim()
  .transform((value) => {
    if (value.length === 0) return null;
    const cents = parseBRLToCents(value);
    return cents === 0 ? null : cents;
  })
  .pipe(
    z
      .number("Troco inválido")
      .int("Use no máximo duas casas decimais no troco")
      .min(0, "Troco não pode ser negativo")
      .max(MAX_MONEY_CENTS, "Troco muito alto")
      .nullable(),
  );

export const cartItemInputSchema = z.object({
  productId: z.string().uuid("Produto inválido"),
  quantity: z.coerce
    .number("Quantidade inválida")
    .int("A quantidade deve ser inteira")
    .min(1, "Quantidade mínima é 1")
    .max(MAX_QUANTITY, `Quantidade máxima é ${MAX_QUANTITY}`),
  optionIds: z.array(z.string().uuid("Adicional inválido")).max(30, "Adicionais demais"),
  notes: z.string().trim().max(200, "Observação muito longa"),
});

export type CartItemInput = z.infer<typeof cartItemInputSchema>;

export const checkoutInputSchema = z
  .object({
    items: z
      .array(cartItemInputSchema)
      .min(1, "Adicione pelo menos um item")
      .max(MAX_ITEMS, "Pedido com itens demais"),
    type: z.enum(["delivery", "pickup"], "Escolha entrega ou retirada"),
    customerName: z
      .string()
      .trim()
      .min(2, "Informe seu nome")
      .max(80, "Nome muito longo"),
    customerPhone: z
      .string()
      .trim()
      .transform(normalizePhone)
      .pipe(
        z
          .string()
          .regex(/^\d{10,11}$/, "Telefone inválido: informe DDD e número"),
      ),
    addressStreet: z.string().trim().max(120, "Rua muito longa"),
    addressNumber: z.string().trim().max(20, "Número muito longo"),
    addressComplement: z.string().trim().max(80, "Complemento muito longo"),
    addressDistrict: z.string().trim().max(80, "Bairro muito longo"),
    addressReference: z.string().trim().max(120, "Referência muito longa"),
    paymentMethod: z.enum(["cash", "card", "pix"], "Escolha a forma de pagamento"),
    changeFor: optionalMoneyField,
    notes: z.string().trim().max(300, "Observação muito longa"),
    idempotencyKey: z.string().uuid("Chave do pedido inválida"),
  })
  .superRefine((value, ctx) => {
    if (value.paymentMethod !== "cash" && value.changeFor !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["changeFor"],
        message: "Troco só se aplica a pagamento em dinheiro",
      });
    }

    if (value.type !== "delivery") return;

    if (value.addressStreet.length < 3) {
      ctx.addIssue({
        code: "custom",
        path: ["addressStreet"],
        message: "Informe a rua da entrega",
      });
    }
    if (value.addressNumber.length < 1) {
      ctx.addIssue({
        code: "custom",
        path: ["addressNumber"],
        message: "Informe o número",
      });
    }
    if (value.addressDistrict.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["addressDistrict"],
        message: "Informe o bairro",
      });
    }
  });

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;

/** Texto único usado no cupom e na tela do pedido. */
export function formatAddress(order: {
  addressStreet: string;
  addressNumber: string;
  addressComplement: string;
  addressDistrict: string;
  addressReference: string;
}): string {
  const line = [order.addressStreet, order.addressNumber].filter(Boolean).join(", ");
  const parts = [
    line,
    order.addressComplement,
    order.addressDistrict,
    order.addressReference ? `Ref.: ${order.addressReference}` : "",
  ].filter((part) => part.length > 0);

  return parts.join(" · ");
}
