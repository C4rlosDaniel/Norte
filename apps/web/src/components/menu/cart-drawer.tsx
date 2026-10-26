"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { formatBRL } from "@/server/money";

import {
  CART_MAX_QUANTITY,
  cartItemCount,
  cartSubtotal,
  hasCartErrors,
  type ResolvedCartLine,
  type StoredCartLine,
} from "./cart";

type Props = {
  slug: string;
  open: boolean;
  lines: StoredCartLine[];
  resolved: ResolvedCartLine[];
  onClose: () => void;
  onChangeQuantity: (key: string, quantity: number) => void;
  onRemove: (key: string) => void;
  onClear: () => void;
};

export function CartDrawer({
  slug,
  open,
  lines,
  resolved,
  onClose,
  onChangeQuantity,
  onRemove,
  onClear,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const subtotal = cartSubtotal(resolved);
  const count = cartItemCount(lines);
  const errors = hasCartErrors(resolved);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className="m-auto max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-leather/20 bg-paper p-5 shadow-xl backdrop:bg-leather/40 sm:rounded-2xl"
      aria-labelledby="cart-dialog-title"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="cart-dialog-title" className="font-display text-2xl">
            Seu pedido
          </h2>
          <button type="button" className="btn btn-secondary px-3 py-1 text-xs" onClick={onClose}>
            Continuar escolhendo
          </button>
        </div>

        {resolved.length === 0 ? (
          <p className="text-sm text-ink-soft">O carrinho está vazio.</p>
        ) : (
          <ul className="space-y-3">
            {resolved.map((item) => (
              <li key={item.key} className="rounded-xl border border-leather/15 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {item.line.quantity}× {item.productName}
                    </p>
                    {item.selections.length > 0 ? (
                      <p className="mt-1 text-xs text-ink-soft">
                        {item.selections
                          .map((selection) => `${selection.groupName}: ${selection.optionName}`)
                          .join(" · ")}
                      </p>
                    ) : null}
                    {item.line.notes ? (
                      <p className="mt-1 text-xs text-ink-soft">Obs.: {item.line.notes}</p>
                    ) : null}
                    {item.error ? (
                      <p role="alert" className="mt-1 text-xs font-semibold text-terracotta">
                        {item.error}
                      </p>
                    ) : null}
                  </div>
                  <p className="whitespace-nowrap font-semibold">
                    {formatBRL(item.lineTotalCents)}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Diminuir ${item.productName}`}
                      className="btn btn-secondary h-8 w-8 p-0 text-sm"
                      onClick={() => onChangeQuantity(item.key, item.line.quantity - 1)}
                      disabled={item.line.quantity <= 1}
                    >
                      −
                    </button>
                    <span className="min-w-5 text-center text-sm font-semibold">
                      {item.line.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={`Aumentar ${item.productName}`}
                      className="btn btn-secondary h-8 w-8 p-0 text-sm"
                      onClick={() => onChangeQuantity(item.key, item.line.quantity + 1)}
                      disabled={item.line.quantity >= CART_MAX_QUANTITY}
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    className="text-xs font-semibold text-terracotta underline underline-offset-2"
                    onClick={() => onRemove(item.key)}
                  >
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-1 border-t border-leather/10 pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-soft">Subtotal ({count} itens)</span>
            <span className="font-semibold">{formatBRL(subtotal)}</span>
          </div>
          <p className="text-xs text-ink-soft">
            Taxa de entrega e forma de pagamento são definidas no checkout.
          </p>
        </div>

        {errors ? (
          <p role="alert" className="text-sm font-semibold text-terracotta">
            Remova ou ajuste os itens indisponíveis para fechar o pedido.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/checkout/${slug}`}
            className={`btn btn-primary flex-1 ${errors ? "pointer-events-none opacity-60" : ""}`}
            aria-disabled={errors}
            tabIndex={errors ? -1 : undefined}
          >
            Fechar pedido
          </Link>
          {resolved.length > 0 ? (
            <button type="button" className="btn btn-secondary" onClick={onClear}>
              Limpar
            </button>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
