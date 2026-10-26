"use client";

import { useActionState } from "react";

import type { Product } from "@/server/db/schema";
import { centsToInputValue } from "@/server/money";
import {
  createProductAction,
  deleteProductAction,
  updateProductAction,
  type MenuFormState,
} from "./actions";
import { FieldError, FormFeedback, SubmitButton } from "./form-ui";

const initialState: MenuFormState = { status: "idle" };

type CategoryOption = { id: string; name: string; isActive: boolean };

export function ProductForm({
  mode,
  categories,
  product,
  defaultCategoryId,
}: {
  mode: "create" | "edit";
  categories: CategoryOption[];
  product?: Product;
  defaultCategoryId?: string;
}) {
  const action = mode === "create" ? createProductAction : updateProductAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [deleteState, deleteAction, deleting] = useActionState(
    deleteProductAction,
    initialState,
  );

  const selectedCategory =
    product?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? "";

  return (
    <div className="space-y-4">
      <form action={formAction} className="card space-y-5 p-6">
        {product ? <input type="hidden" name="productId" value={product.id} /> : null}

        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
          <div>
            <label className="label" htmlFor="product-name">
              Nome
            </label>
            <input
              id="product-name"
              name="name"
              defaultValue={product?.name}
              className="input"
              maxLength={100}
              placeholder="Ex.: Baião de Dois"
              required
            />
            <FieldError messages={state.fieldErrors?.["name"]} />
          </div>

          <div>
            <label className="label" htmlFor="product-price">
              Preço (R$)
            </label>
            <input
              id="product-price"
              name="price"
              defaultValue={product ? centsToInputValue(product.priceCents) : ""}
              className="input"
              inputMode="decimal"
              placeholder="0,00"
              required
            />
            <FieldError messages={state.fieldErrors?.["price"]} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="product-category">
            Categoria
          </label>
          <select
            id="product-category"
            name="categoryId"
            defaultValue={selectedCategory}
            className="input"
            required
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {category.isActive ? "" : " (inativa)"}
              </option>
            ))}
          </select>
          <FieldError messages={state.fieldErrors?.["categoryId"]} />
        </div>

        <div>
          <label className="label" htmlFor="product-description">
            Descrição
          </label>
          <textarea
            id="product-description"
            name="description"
            defaultValue={product?.description}
            className="input min-h-24"
            maxLength={600}
            placeholder="Ingredientes, acompanhamentos, observações"
          />
          <FieldError messages={state.fieldErrors?.["description"]} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="product-serves">
              Serve
            </label>
            <input
              id="product-serves"
              name="servesLabel"
              defaultValue={product?.servesLabel}
              className="input"
              maxLength={40}
              placeholder="Serve 1"
            />
            <FieldError messages={state.fieldErrors?.["servesLabel"]} />
          </div>

          <div>
            <label className="label" htmlFor="product-badge">
              Selo
            </label>
            <input
              id="product-badge"
              name="badge"
              defaultValue={product?.badge}
              className="input"
              maxLength={40}
              placeholder="Mais pedido"
            />
            <FieldError messages={state.fieldErrors?.["badge"]} />
          </div>

          <div>
            <label className="label" htmlFor="product-order">
              Ordem
            </label>
            <input
              id="product-order"
              name="sortOrder"
              type="number"
              min={0}
              max={9999}
              defaultValue={product?.sortOrder ?? 0}
              className="input"
            />
            <FieldError messages={state.fieldErrors?.["sortOrder"]} />
          </div>
        </div>

        <div className="space-y-3 rounded-lg bg-kraft/60 p-4">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="isAvailable"
              defaultChecked={product?.isAvailable ?? true}
              className="mt-0.5 h-4 w-4 accent-cactus"
            />
            <span>
              <span className="font-semibold">Disponível</span>
              <span className="block text-xs text-ink-soft">
                Desmarcado, o produto aparece no cardápio como indisponível e não deve ser vendido.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="isFeatured"
              defaultChecked={product?.isFeatured ?? false}
              className="mt-0.5 h-4 w-4 accent-sun"
            />
            <span>
              <span className="font-semibold">Destaque</span>
              <span className="block text-xs text-ink-soft">
                Aparece em &quot;Os mais pedidos&quot; no topo do cardápio público.
              </span>
            </span>
          </label>
        </div>

        <FormFeedback state={state} />

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pending={pending} pendingLabel="Salvando…">
            {mode === "create" ? "Criar produto" : "Salvar produto"}
          </SubmitButton>
          <span className="text-xs text-ink-soft">
            {mode === "create"
              ? "Depois de criar, você poderá cadastrar os adicionais."
              : "Os adicionais são editados abaixo."}
          </span>
        </div>
      </form>

      {product ? (
        <section className="card space-y-3 p-6">
          <h2 className="font-display text-xl">Excluir produto</h2>
          <p className="text-sm text-ink-soft">
            Remove o produto e todos os grupos de adicionais dele. Pedidos antigos não são afetados
            porque guardam um snapshot (Fase 3).
          </p>

          <form
            action={deleteAction}
            onSubmit={(event) => {
              if (!window.confirm(`Excluir o produto "${product.name}"?`)) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="productId" value={product.id} />
            <SubmitButton
              pending={deleting}
              pendingLabel="Excluindo…"
              className="btn text-xs font-semibold text-terracotta underline underline-offset-2 disabled:opacity-60"
            >
              Excluir produto
            </SubmitButton>
          </form>

          <FormFeedback state={deleteState} />
        </section>
      ) : null}
    </div>
  );
}
