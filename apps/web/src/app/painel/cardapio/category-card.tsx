"use client";

import Link from "next/link";
import { useActionState } from "react";

import { formatBRL } from "@/server/money";
import type { MenuCategoryWithProducts } from "@/server/menu/queries";
import {
  deleteCategoryAction,
  toggleProductAvailabilityAction,
  updateCategoryAction,
  type MenuFormState,
} from "./actions";
import { FieldError, FormFeedback, PendingButton, SubmitButton } from "./form-ui";

const initialState: MenuFormState = { status: "idle" };

export function CategoryCard({ category }: { category: MenuCategoryWithProducts }) {
  const [updateState, updateAction, updating] = useActionState(
    updateCategoryAction,
    initialState,
  );
  const [deleteState, deleteAction, deleting] = useActionState(
    deleteCategoryAction,
    initialState,
  );

  return (
    <article className="card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-leather/10 px-5 py-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl">{category.name}</h2>
            {category.isActive ? null : <span className="badge badge-closed">Inativa</span>}
          </div>
          <p className="text-xs text-ink-soft">
            Ordem {category.sortOrder} · {category.products.length}{" "}
            {category.products.length === 1 ? "produto" : "produtos"}
            {category.description ? ` · ${category.description}` : ""}
          </p>
        </div>

        <Link
          href={`/painel/cardapio/produtos/novo?categoria=${category.id}`}
          className="btn btn-secondary text-xs"
        >
          Novo produto
        </Link>
      </header>

      {category.products.length === 0 ? (
        <p className="px-5 py-5 text-sm text-ink-soft">
          Nenhum produto nesta categoria ainda.
        </p>
      ) : (
        <ul className="divide-y divide-leather/10">
          {category.products.map((product) => (
            <li
              key={product.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{product.name}</span>
                  {product.badge ? (
                    <span className="badge badge-open">{product.badge}</span>
                  ) : null}
                  {product.isFeatured ? (
                    <span className="badge badge-open">Destaque</span>
                  ) : null}
                  {product.isAvailable ? null : (
                    <span className="badge badge-closed">Indisponível</span>
                  )}
                </div>
                <p className="text-xs text-ink-soft">
                  {formatBRL(product.priceCents)}
                  {product.modifierGroups.length > 0
                    ? ` · ${product.modifierGroups.length} ${
                        product.modifierGroups.length === 1
                          ? "grupo de adicionais"
                          : "grupos de adicionais"
                      }`
                    : ""}
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <form action={toggleProductAvailabilityAction}>
                  <input type="hidden" name="productId" value={product.id} />
                  <input
                    type="hidden"
                    name="isAvailable"
                    value={product.isAvailable ? "false" : "true"}
                  />
                  <PendingButton
                    pendingLabel="Salvando…"
                    className="font-semibold underline underline-offset-2 disabled:opacity-60"
                  >
                    {product.isAvailable ? "Pausar" : "Ativar"}
                  </PendingButton>
                </form>

                <Link
                  href={`/painel/cardapio/produtos/${product.id}`}
                  className="font-semibold underline underline-offset-2"
                >
                  Editar
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <details className="border-t border-leather/10 px-5 py-3">
        <summary className="cursor-pointer text-sm font-semibold">Editar categoria</summary>

        <div className="mt-4 space-y-4">
          <form action={updateAction} className="space-y-4">
            <input type="hidden" name="categoryId" value={category.id} />

            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <div>
                <label className="label" htmlFor={`category-name-${category.id}`}>
                  Nome
                </label>
                <input
                  id={`category-name-${category.id}`}
                  name="name"
                  defaultValue={category.name}
                  className="input"
                  maxLength={80}
                  required
                />
                <FieldError messages={updateState.fieldErrors?.["name"]} />
              </div>

              <div>
                <label className="label" htmlFor={`category-order-${category.id}`}>
                  Ordem
                </label>
                <input
                  id={`category-order-${category.id}`}
                  name="sortOrder"
                  type="number"
                  min={0}
                  max={9999}
                  defaultValue={category.sortOrder}
                  className="input"
                />
                <FieldError messages={updateState.fieldErrors?.["sortOrder"]} />
              </div>
            </div>

            <div>
              <label className="label" htmlFor={`category-description-${category.id}`}>
                Descrição (opcional)
              </label>
              <input
                id={`category-description-${category.id}`}
                name="description"
                defaultValue={category.description}
                className="input"
                maxLength={300}
              />
              <FieldError messages={updateState.fieldErrors?.["description"]} />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={category.isActive}
                className="h-4 w-4 accent-cactus"
              />
              Visível no cardápio público
            </label>

            <FormFeedback state={updateState} />

            <SubmitButton pending={updating} className="btn btn-primary text-xs">
              Salvar categoria
            </SubmitButton>
          </form>

          <div className="border-t border-leather/10 pt-4">
            <form
              action={deleteAction}
              onSubmit={(event) => {
                if (!window.confirm(`Remover a categoria "${category.name}"?`)) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="categoryId" value={category.id} />
              <SubmitButton
                pending={deleting}
                pendingLabel="Removendo…"
                className="text-xs font-semibold text-terracotta underline underline-offset-2 disabled:opacity-60"
              >
                Remover categoria
              </SubmitButton>
            </form>
            <FormFeedback state={deleteState} />
          </div>
        </div>
      </details>
    </article>
  );
}
