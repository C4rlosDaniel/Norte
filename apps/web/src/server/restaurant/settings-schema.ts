import { z } from "zod";

import { parseBRLToCents } from "@/server/money";

const moneyField = z
  .string()
  .trim()
  .min(1, "Informe um valor")
  .transform((value) => parseBRLToCents(value))
  .pipe(z.number("Valor inválido").int("Use no máximo duas casas decimais").min(0).max(100_000));

export const settingsInputSchema = z.object({
  phone: z.string().trim().min(8, "Telefone muito curto").max(20, "Telefone muito longo"),
  addressLine: z.string().trim().min(5, "Informe o endereço").max(200, "Endereço muito longo"),
  deliveryFee: moneyField,
  deliveryEnabled: z.boolean(),
  isManuallyClosed: z.boolean(),
  closedMessage: z.string().trim().min(1, "Escreva a mensagem").max(500, "Máximo de 500 caracteres"),
});

export type SettingsInput = z.infer<typeof settingsInputSchema>;
