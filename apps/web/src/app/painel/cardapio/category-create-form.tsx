"use client";

import { useActionState, useEffect, useRef } from "react";

import { createCategoryAction, type MenuFormState } from "./actions";
import { FieldError, FormFeedback, SubmitButton } from "./form-ui";

const initialState: MenuFormState = { status: "idle" };

export function CategoryCreateForm() {
  const [state, formAction, pending] = useActionState(createCategoryAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <section className="card p-5">
      <h2 className="font-display text-xl">Nova categoria</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Categorias organizam o cardápio. A ordem define o que aparece primeiro.
      </p>

      <form ref={formRef} action={formAction} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
          <div>
            <label className="label" htmlFor="new-category-name">
              Nome
            </label>
            <input
              id="new-category-name"
              name="name"
              className="input"
              placeholder="Ex.: Porções"
              maxLength={80}
              required
            />
            <FieldError messages={state.fieldErrors?.["name"]} />
          </div>

          <div>
            <label className="label" htmlFor="new-category-order">
              Ordem
            </label>
            <input
              id="new-category-order"
              name="sortOrder"
              type="number"
              min={0}
              max={9999}
              defaultValue={0}
              className="input"
            />
            <FieldError messages={state.fieldErrors?.["sortOrder"]} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="new-category-description">
            Descrição (opcional)
          </label>
          <input
            id="new-category-description"
            name="description"
            className="input"
            maxLength={300}
            placeholder="Uma frase curta sobre a categoria"
          />
          <FieldError messages={state.fieldErrors?.["description"]} />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked
            className="h-4 w-4 accent-cactus"
          />
          Visível no cardápio público
        </label>

        <FormFeedback state={state} />

        <SubmitButton pending={pending} pendingLabel="Criando…">
          Criar categoria
        </SubmitButton>
      </form>
    </section>
  );
}
