/**
 * Formatos serializáveis gravados no banco (colunas jsonb).
 * Não importam o schema para evitar ciclo; os valores literais espelham os enums.
 */

export type OrderTypeValue = "delivery" | "pickup";

export type PaymentMethodValue = "cash" | "card" | "pix";

export type PrintJobModifier = {
  group: string;
  option: string;
  priceCents: number;
};

export type PrintJobItem = {
  productName: string;
  quantity: number;
  unitPriceCents: number;
  modifiers: PrintJobModifier[];
  modifiersTotalCents: number;
  lineTotalCents: number;
  notes: string;
};

/**
 * Payload fechado do cupom. O agente de impressão (Fase 4) não consulta o banco:
 * imprime exatamente este snapshot.
 */
export type PrintJobPayload = {
  version: 1;
  orderNumber: number;
  linkCode: string;
  createdAt: string;
  restaurant: {
    name: string;
    phone: string;
    addressLine: string;
  };
  type: OrderTypeValue;
  customer: {
    name: string;
    phone: string;
  };
  address: string | null;
  items: PrintJobItem[];
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  payment: {
    method: PaymentMethodValue;
    label: string;
    changeForCents: number | null;
  };
  notes: string;
};

/** Dados mínimos para a Fase 5 montar a confirmação sem reler o pedido. */
export type WhatsAppTaskPayload = {
  phone: string;
  customerName: string;
  orderNumber: number;
  linkCode: string;
  totalCents: number;
  type: OrderTypeValue;
};
