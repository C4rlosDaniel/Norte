const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Formata centavos como moeda brasileira. Toda persistência é em centavos inteiros. */
export function formatBRL(cents: number): string {
  if (!Number.isFinite(cents)) return "—";
  return brlFormatter.format(cents / 100).replace(/\u00a0/g, " ");
}

/**
 * Converte texto digitado no painel para centavos.
 * Aceita "12,50", "12.50", "R$ 1.234,56" e "1234".
 * Retorna null quando não é possível interpretar como valor não negativo.
 */
export function parseBRLToCents(input: string): number | null {
  const cleaned = input.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned || cleaned === "-") return null;

  let normalized = cleaned;

  if (cleaned.includes(",")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    const parts = cleaned.split(".");
    const isThousandsOnly = parts.length > 2 || (parts.length === 2 && (parts[1] ?? "").length === 3);
    if (isThousandsOnly) normalized = cleaned.replace(/\./g, "");
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;

  return Math.round(value * 100);
}

/** Para formulários: centavos -> "12,50". */
export function centsToInputValue(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
