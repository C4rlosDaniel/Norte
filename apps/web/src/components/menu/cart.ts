import { z } from "zod";

import type { MenuProduct } from "@/server/menu/queries";

export const CART_MAX_QUANTITY = 20;
const CART_MAX_LINES = 50;

export const storedCartLineSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(CART_MAX_QUANTITY),
  optionIds: z.array(z.string().uuid()).max(30),
  notes: z.string().max(200),
});

export const storedCartSchema = z.array(storedCartLineSchema).max(CART_MAX_LINES);

export type StoredCartLine = z.infer<typeof storedCartLineSchema>;

export type CartSelection = {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceCents: number;
};

export type ResolvedCartLine = {
  key: string;
  line: StoredCartLine;
  productName: string;
  unitPriceCents: number;
  modifiersTotalCents: number;
  lineTotalCents: number;
  selections: CartSelection[];
  error: string | null;
};

export function cartKey(productId: string, optionIds: string[], notes = ""): string {
  return `${productId}|${[...optionIds].sort().join(",")}|${notes}`;
}

/** Junta linhas iguais (produto + adicionais + observação) respeitando o limite. */
export function mergeCartLine(lines: StoredCartLine[], incoming: StoredCartLine): StoredCartLine[] {
  const key = cartKey(incoming.productId, incoming.optionIds, incoming.notes);
  const index = lines.findIndex(
    (line) => cartKey(line.productId, line.optionIds, line.notes) === key,
  );

  if (index === -1) return [...lines, incoming];

  const next = [...lines];
  const current = next[index];
  if (!current) return [...lines, incoming];

  next[index] = {
    ...current,
    quantity: Math.min(current.quantity + incoming.quantity, CART_MAX_QUANTITY),
  };

  return next;
}

export function resolveCartLine(product: MenuProduct, line: StoredCartLine): ResolvedCartLine {
  const errors: string[] = [];
  const selections: CartSelection[] = [];

  if (!product.isAvailable) {
    errors.push(`${product.name} está indisponível.`);
  }

  const selectedByGroup = new Map<string, string[]>();
  const seenOptions = new Set<string>();

  for (const optionId of line.optionIds) {
    if (seenOptions.has(optionId)) {
      errors.push("Adicional repetido.");
      continue;
    }
    seenOptions.add(optionId);

    const group = product.modifierGroups.find((item) =>
      item.options.some((option) => option.id === optionId),
    );
    const option = group?.options.find((item) => item.id === optionId);

    if (!group || !option) {
      errors.push("Um adicional saiu do cardápio.");
      continue;
    }

    const current = selectedByGroup.get(group.id) ?? [];
    current.push(optionId);
    selectedByGroup.set(group.id, current);

    selections.push({
      groupId: group.id,
      groupName: group.name,
      optionId: option.id,
      optionName: option.name,
      priceCents: option.priceCents,
    });
  }

  for (const group of product.modifierGroups) {
    const count = (selectedByGroup.get(group.id) ?? []).length;
    if (count < group.minSelections) {
      errors.push(`Escolha ${group.minSelections} opção(ões) em "${group.name}".`);
    }
    if (count > group.maxSelections) {
      errors.push(`Máximo de ${group.maxSelections} opção(ões) em "${group.name}".`);
    }
  }

  const modifiersTotalCents = selections.reduce(
    (total, selection) => total + selection.priceCents,
    0,
  );
  const unitPriceCents = product.priceCents + modifiersTotalCents;

  return {
    key: cartKey(line.productId, line.optionIds, line.notes),
    line,
    productName: product.name,
    unitPriceCents,
    modifiersTotalCents,
    lineTotalCents: unitPriceCents * line.quantity,
    selections,
    error: errors.length > 0 ? errors.join(" ") : null,
  };
}

export function resolveCart(
  catalog: Map<string, MenuProduct>,
  lines: StoredCartLine[],
): ResolvedCartLine[] {
  return lines.map((line) => {
    const product = catalog.get(line.productId);
    if (!product) {
      return {
        key: cartKey(line.productId, line.optionIds, line.notes),
        line,
        productName: "Item removido do cardápio",
        unitPriceCents: 0,
        modifiersTotalCents: 0,
        lineTotalCents: 0,
        selections: [],
        error: "Este item saiu do cardápio. Remova para continuar.",
      };
    }

    return resolveCartLine(product, line);
  });
}

export function cartSubtotal(resolved: ResolvedCartLine[]): number {
  return resolved.reduce((total, line) => total + line.lineTotalCents, 0);
}

export function cartItemCount(lines: StoredCartLine[]): number {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

export function hasCartErrors(resolved: ResolvedCartLine[]): boolean {
  return resolved.some((line) => line.error !== null);
}

const CART_PREFIX = "norte:cart:";
const CHECKOUT_KEY_PREFIX = "norte:checkout-key:";

export function loadStoredCart(slug: string): StoredCartLine[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(`${CART_PREFIX}${slug}`);
    if (!raw) return [];
    const parsed = storedCartSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function saveStoredCart(slug: string, lines: StoredCartLine[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${CART_PREFIX}${slug}`, JSON.stringify(lines));
  } catch {
    // Armazenamento cheio/privado: o carrinho continua só em memória.
  }
}

export function clearStoredCart(slug: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(`${CART_PREFIX}${slug}`);
  } catch {
    // Ignora ambientes sem storage.
  }
}

/**
 * Chave de idempotência por sessão de checkout. O botão de enviar pode ser
 * clicado duas vezes (ou a rede falhar) sem criar dois pedidos.
 */
export function getCheckoutKey(slug: string): string {
  if (typeof window === "undefined") return crypto.randomUUID();

  const storageKey = `${CHECKOUT_KEY_PREFIX}${slug}`;
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing && z.string().uuid().safeParse(existing).success) return existing;

  const generated = crypto.randomUUID();
  window.sessionStorage.setItem(storageKey, generated);
  return generated;
}

export function clearCheckoutKey(slug: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(`${CHECKOUT_KEY_PREFIX}${slug}`);
}
