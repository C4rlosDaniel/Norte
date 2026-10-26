import { z } from "zod";

import { parseBRLToCents } from "@/server/money";

const MAX_PRICE_CENTS = 10_000_000;

function moneyField(label: string, options: { optional?: boolean } = {}) {
  return z
    .string()
    .trim()
    .transform((value) => {
      if (options.optional && value.length === 0) return 0;
      return parseBRLToCents(value);
    })
    .pipe(
      z
        .number(`${label} inválido`)
        .int(`Use no máximo duas casas decimais em ${label.toLowerCase()}`)
        .min(0, `${label} não pode ser negativo`)
        .max(MAX_PRICE_CENTS, `${label} muito alto`),
    );
}

const sortOrderField = z.coerce
  .number("Ordem inválida")
  .int("A ordem deve ser um número inteiro")
  .min(0, "A ordem não pode ser negativa")
  .max(9_999, "Ordem muito alta");

export const categoryIdSchema = z.string().uuid("Categoria inválida");
export const productIdSchema = z.string().uuid("Produto inválido");
export const modifierGroupIdSchema = z.string().uuid("Grupo inválido");
export const modifierOptionIdSchema = z.string().uuid("Adicional inválido");

export const categoryInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "O nome precisa ter pelo menos 2 caracteres")
    .max(80, "O nome pode ter no máximo 80 caracteres"),
  description: z.string().trim().max(300, "Máximo de 300 caracteres"),
  sortOrder: sortOrderField,
  isActive: z.boolean(),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const productInputSchema = z.object({
  categoryId: categoryIdSchema,
  name: z
    .string()
    .trim()
    .min(2, "O nome precisa ter pelo menos 2 caracteres")
    .max(100, "O nome pode ter no máximo 100 caracteres"),
  description: z.string().trim().max(600, "Máximo de 600 caracteres"),
  price: moneyField("Preço"),
  servesLabel: z.string().trim().max(40, "Máximo de 40 caracteres"),
  badge: z.string().trim().max(40, "Máximo de 40 caracteres"),
  isAvailable: z.boolean(),
  isFeatured: z.boolean(),
  sortOrder: sortOrderField,
});

export type ProductInput = z.infer<typeof productInputSchema>;

export const modifierGroupInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Informe o nome do grupo")
      .max(60, "O nome pode ter no máximo 60 caracteres"),
    minSelections: z.coerce
      .number("Mínimo inválido")
      .int("O mínimo deve ser inteiro")
      .min(0, "O mínimo não pode ser negativo")
      .max(20, "Máximo de 20 escolhas"),
    maxSelections: z.coerce
      .number("Máximo inválido")
      .int("O máximo deve ser inteiro")
      .min(1, "O máximo precisa ser pelo menos 1")
      .max(20, "Máximo de 20 escolhas"),
    sortOrder: sortOrderField,
  })
  .refine((value) => value.maxSelections >= value.minSelections, {
    message: "O máximo precisa ser maior ou igual ao mínimo",
    path: ["maxSelections"],
  });

export type ModifierGroupInput = z.infer<typeof modifierGroupInputSchema>;

export const modifierOptionInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe o nome do adicional")
    .max(60, "O nome pode ter no máximo 60 caracteres"),
  price: moneyField("Preço", { optional: true }),
  isAvailable: z.boolean(),
  sortOrder: sortOrderField,
});

export type ModifierOptionInput = z.infer<typeof modifierOptionInputSchema>;
