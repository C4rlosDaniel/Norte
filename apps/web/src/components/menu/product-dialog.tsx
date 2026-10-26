"use client";

import { useEffect, useRef, useState } from "react";

import { formatBRL } from "@/server/money";
import type { MenuProduct } from "@/server/menu/queries";

import { CART_MAX_QUANTITY, type StoredCartLine } from "./cart";

type Props = {
  product: MenuProduct | null;
  orderingDisabled: boolean;
  onClose: () => void;
  onAdd: (line: StoredCartLine) => void;
};

export function ProductDialog({ product, orderingDisabled, onClose, onAdd }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const open = product !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      setSelected({});
      setQuantity(1);
      setNotes("");
      setError(null);
      dialog.showModal();
    }

    if (!open && dialog.open) dialog.close();
  }, [open]);

  function toggleOption(groupId: string, optionId: string, maxSelections: number) {
    setSelected((previous) => {
      const current = previous[groupId] ?? [];

      if (current.includes(optionId)) {
        return { ...previous, [groupId]: current.filter((id) => id !== optionId) };
      }

      if (current.length >= maxSelections) {
        if (maxSelections === 1) return { ...previous, [groupId]: [optionId] };
        return previous;
      }

      return { ...previous, [groupId]: [...current, optionId] };
    });
  }

  function clearGroup(groupId: string) {
    setSelected((previous) => ({ ...previous, [groupId]: [] }));
  }

  if (!product) {
    return <dialog ref={dialogRef} onClose={onClose} className="hidden" />;
  }

  const optionIds = Object.values(selected).flat();
  const modifiersTotal = product.modifierGroups.reduce((total, group) => {
    const chosen = new Set(selected[group.id] ?? []);
    return (
      total +
      group.options
        .filter((option) => chosen.has(option.id))
        .reduce((sum, option) => sum + option.priceCents, 0)
    );
  }, 0);
  const unitTotal = product.priceCents + modifiersTotal;
  const canAdd = product.isAvailable && !orderingDisabled;

  function handleAdd() {
    if (!product) return;

    for (const group of product.modifierGroups) {
      const count = (selected[group.id] ?? []).length;
      if (count < group.minSelections) {
        setError(`Escolha ${group.minSelections} opção(ões) em "${group.name}".`);
        return;
      }
    }

    if (optionIds.length > 30) {
      setError("Adicionais demais neste item.");
      return;
    }

    onAdd({
      productId: product.id,
      quantity,
      optionIds: [...optionIds].sort(),
      notes: notes.trim(),
    });
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className="m-auto max-h-[92vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-leather/20 bg-paper p-5 shadow-xl backdrop:bg-leather/40"
      aria-labelledby="product-dialog-title"
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="product-dialog-title" className="font-display text-2xl leading-tight">
              {product.name}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              {formatBRL(product.priceCents)}
              {product.servesLabel ? ` · ${product.servesLabel}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-secondary px-3 py-1 text-xs">
            Fechar
          </button>
        </div>

        {product.description ? (
          <p className="text-sm text-ink-soft">{product.description}</p>
        ) : null}

        {product.modifierGroups.map((group) => {
          const chosen = selected[group.id] ?? [];
          const isRadio = group.maxSelections === 1;

          return (
            <fieldset key={group.id} className="space-y-2">
              <legend className="flex flex-wrap items-baseline gap-2 font-semibold">
                {group.name}
                <span className="text-xs font-medium text-ink-soft">
                  {group.minSelections > 0 ? "obrigatório" : "opcional"}
                  {" · "}
                  {group.maxSelections === 1
                    ? "escolha 1"
                    : `escolha até ${group.maxSelections}`}
                </span>
              </legend>

              {isRadio && group.minSelections === 0 ? (
                <label className="flex items-center justify-between gap-3 rounded-lg border border-leather/15 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={group.id}
                      checked={chosen.length === 0}
                      onChange={() => clearGroup(group.id)}
                    />
                    Sem adicional
                  </span>
                </label>
              ) : null}

              {group.options.map((option) => {
                const checked = chosen.includes(option.id);
                const limitReached =
                  !isRadio && !checked && chosen.length >= group.maxSelections;

                return (
                  <label
                    key={option.id}
                    className={`flex items-center justify-between gap-3 rounded-lg border border-leather/15 px-3 py-2 text-sm ${
                      limitReached ? "opacity-50" : ""
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type={isRadio ? "radio" : "checkbox"}
                        name={isRadio ? group.id : `${group.id}-${option.id}`}
                        checked={checked}
                        disabled={limitReached}
                        onChange={() => toggleOption(group.id, option.id, group.maxSelections)}
                      />
                      {option.name}
                    </span>
                    <span className="whitespace-nowrap text-ink-soft">
                      {option.priceCents > 0 ? `+${formatBRL(option.priceCents)}` : "grátis"}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          );
        })}

        <div>
          <label className="label" htmlFor="item-notes">
            Observação do item
          </label>
          <input
            id="item-notes"
            className="input"
            maxLength={200}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Ex.: sem cebola, ponto da carne..."
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm font-semibold text-terracotta">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-leather/10 pt-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Diminuir quantidade"
              className="btn btn-secondary h-9 w-9 p-0"
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            >
              −
            </button>
            <span className="min-w-6 text-center font-semibold">{quantity}</span>
            <button
              type="button"
              aria-label="Aumentar quantidade"
              className="btn btn-secondary h-9 w-9 p-0"
              disabled={quantity >= CART_MAX_QUANTITY}
              onClick={() => setQuantity((value) => Math.min(CART_MAX_QUANTITY, value + 1))}
            >
              +
            </button>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            disabled={!canAdd}
            onClick={handleAdd}
          >
            Adicionar · {formatBRL(unitTotal * quantity)}
          </button>
        </div>

        {orderingDisabled ? (
          <p className="text-xs text-ink-soft">
            O restaurante está fechado; não é possível adicionar itens agora.
          </p>
        ) : null}
      </div>
    </dialog>
  );
}
