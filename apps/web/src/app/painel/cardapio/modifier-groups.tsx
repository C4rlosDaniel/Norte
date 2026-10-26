"use client";

import { useActionState, useEffect, useRef } from "react";

import type { ModifierOption } from "@/server/db/schema";
import { centsToInputValue, formatBRL } from "@/server/money";
import type { MenuModifierGroup } from "@/server/menu/queries";
import {
  createModifierGroupAction,
  createModifierOptionAction,
  deleteModifierGroupAction,
  deleteModifierOptionAction,
  updateModifierGroupAction,
  updateModifierOptionAction,
  type MenuFormState,
} from "./actions";
import { FieldError, FormFeedback, SubmitButton } from "./form-ui";

const initialState: MenuFormState = { status: "idle" };

function requirementLabel(group: MenuModifierGroup): string {
  if (group.minSelections > 0) {
    const range =
      group.minSelections === group.maxSelections
        ? `${group.minSelections}`
        : `${group.minSelections} a ${group.maxSelections}`;
    return `Obrigatório · escolha ${range}`;
  }

  return `Opcional · até ${group.maxSelections}`;
}

export function ModifierGroupsEditor({
  productId,
  groups,
}: {
  productId: string;
  groups: MenuModifierGroup[];
}) {
  return (
    <section className="card space-y-4 p-6">
      <div className="space-y-1">
        <h2 className="font-display text-xl">Adicionais</h2>
        <p className="text-sm text-ink-soft">
          Grupos de escolha do produto (ex.: ponto da carne, extras, embalagem separada). O cliente
          verá as opções no checkout da Fase 3.
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-lg bg-kraft/60 px-4 py-3 text-sm text-ink-soft">
          Nenhum grupo de adicionais neste produto.
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <ModifierGroupCard key={group.id} productId={productId} group={group} />
          ))}
        </div>
      )}

      <CreateGroupForm productId={productId} />
    </section>
  );
}

function CreateGroupForm({ productId }: { productId: string }) {
  const [state, formAction, pending] = useActionState(createModifierGroupAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <details className="rounded-lg border border-leather/15 p-4">
      <summary className="cursor-pointer text-sm font-semibold">Novo grupo de adicionais</summary>

      <form ref={formRef} action={formAction} className="mt-4 space-y-4">
        <input type="hidden" name="productId" value={productId} />

        <div className="grid gap-4 sm:grid-cols-[1fr_100px_100px_100px]">
          <div>
            <label className="label" htmlFor="new-group-name">
              Nome do grupo
            </label>
            <input
              id="new-group-name"
              name="name"
              className="input"
              maxLength={60}
              placeholder="Ex.: Adicionais"
              required
            />
            <FieldError messages={state.fieldErrors?.["name"]} />
          </div>

          <div>
            <label className="label" htmlFor="new-group-min">
              Mínimo
            </label>
            <input
              id="new-group-min"
              name="minSelections"
              type="number"
              min={0}
              max={20}
              defaultValue={0}
              className="input"
            />
            <FieldError messages={state.fieldErrors?.["minSelections"]} />
          </div>

          <div>
            <label className="label" htmlFor="new-group-max">
              Máximo
            </label>
            <input
              id="new-group-max"
              name="maxSelections"
              type="number"
              min={1}
              max={20}
              defaultValue={1}
              className="input"
            />
            <FieldError messages={state.fieldErrors?.["maxSelections"]} />
          </div>

          <div>
            <label className="label" htmlFor="new-group-order">
              Ordem
            </label>
            <input
              id="new-group-order"
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

        <p className="text-xs text-ink-soft">
          Mínimo maior que zero torna a escolha obrigatória. Máximo igual ao mínimo exige exatamente
          aquela quantidade.
        </p>

        <FormFeedback state={state} />

        <SubmitButton pending={pending} pendingLabel="Criando…" className="btn btn-secondary text-xs">
          Criar grupo
        </SubmitButton>
      </form>
    </details>
  );
}

function ModifierGroupCard({
  productId,
  group,
}: {
  productId: string;
  group: MenuModifierGroup;
}) {
  const [updateState, updateAction, updating] = useActionState(
    updateModifierGroupAction,
    initialState,
  );
  const [deleteState, deleteAction, deleting] = useActionState(
    deleteModifierGroupAction,
    initialState,
  );

  return (
    <div className="rounded-lg border border-leather/15 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{group.name}</h3>
          <p className="text-xs text-ink-soft">
            {requirementLabel(group)} · ordem {group.sortOrder}
          </p>
        </div>
        <span className="text-xs text-ink-soft">
          {group.options.length} {group.options.length === 1 ? "opção" : "opções"}
        </span>
      </div>

      {group.options.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">Nenhuma opção cadastrada neste grupo.</p>
      ) : (
        <ul className="mt-3 divide-y divide-leather/10 rounded-lg bg-kraft/40">
          {group.options.map((option) => (
            <ModifierOptionRow
              key={option.id}
              productId={productId}
              groupId={group.id}
              option={option}
            />
          ))}
        </ul>
      )}

      <div className="mt-3">
        <CreateOptionForm productId={productId} groupId={group.id} />
      </div>

      <details className="mt-3 border-t border-leather/10 pt-3">
        <summary className="cursor-pointer text-sm font-semibold">Editar grupo</summary>

        <div className="mt-4 space-y-4">
          <form action={updateAction} className="space-y-4">
            <input type="hidden" name="productId" value={productId} />
            <input type="hidden" name="groupId" value={group.id} />

            <div className="grid gap-4 sm:grid-cols-[1fr_100px_100px_100px]">
              <div>
                <label className="label" htmlFor={`group-name-${group.id}`}>
                  Nome
                </label>
                <input
                  id={`group-name-${group.id}`}
                  name="name"
                  defaultValue={group.name}
                  className="input"
                  maxLength={60}
                  required
                />
                <FieldError messages={updateState.fieldErrors?.["name"]} />
              </div>

              <div>
                <label className="label" htmlFor={`group-min-${group.id}`}>
                  Mínimo
                </label>
                <input
                  id={`group-min-${group.id}`}
                  name="minSelections"
                  type="number"
                  min={0}
                  max={20}
                  defaultValue={group.minSelections}
                  className="input"
                />
                <FieldError messages={updateState.fieldErrors?.["minSelections"]} />
              </div>

              <div>
                <label className="label" htmlFor={`group-max-${group.id}`}>
                  Máximo
                </label>
                <input
                  id={`group-max-${group.id}`}
                  name="maxSelections"
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={group.maxSelections}
                  className="input"
                />
                <FieldError messages={updateState.fieldErrors?.["maxSelections"]} />
              </div>

              <div>
                <label className="label" htmlFor={`group-order-${group.id}`}>
                  Ordem
                </label>
                <input
                  id={`group-order-${group.id}`}
                  name="sortOrder"
                  type="number"
                  min={0}
                  max={9999}
                  defaultValue={group.sortOrder}
                  className="input"
                />
                <FieldError messages={updateState.fieldErrors?.["sortOrder"]} />
              </div>
            </div>

            <FormFeedback state={updateState} />

            <SubmitButton pending={updating} className="btn btn-primary text-xs">
              Salvar grupo
            </SubmitButton>
          </form>

          <div className="border-t border-leather/10 pt-4">
            <form
              action={deleteAction}
              onSubmit={(event) => {
                if (
                  !window.confirm(
                    `Remover o grupo "${group.name}" e todas as suas opções?`,
                  )
                ) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="productId" value={productId} />
              <input type="hidden" name="groupId" value={group.id} />
              <SubmitButton
                pending={deleting}
                pendingLabel="Removendo…"
                className="text-xs font-semibold text-terracotta underline underline-offset-2 disabled:opacity-60"
              >
                Remover grupo
              </SubmitButton>
            </form>
            <FormFeedback state={deleteState} />
          </div>
        </div>
      </details>
    </div>
  );
}

function ModifierOptionRow({
  productId,
  groupId,
  option,
}: {
  productId: string;
  groupId: string;
  option: ModifierOption;
}) {
  const [updateState, updateAction, updating] = useActionState(
    updateModifierOptionAction,
    initialState,
  );
  const [deleteState, deleteAction, deleting] = useActionState(
    deleteModifierOptionAction,
    initialState,
  );

  return (
    <li className="px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{option.name}</span>
          <span className="text-xs text-ink-soft">{formatBRL(option.priceCents)}</span>
          {option.isAvailable ? null : <span className="badge badge-closed">Indisponível</span>}
        </div>

        <details>
          <summary className="cursor-pointer text-xs font-semibold">Editar</summary>

          <div className="mt-3 space-y-3 rounded-lg border border-leather/15 bg-paper p-3">
            <form action={updateAction} className="space-y-3">
              <input type="hidden" name="productId" value={productId} />
              <input type="hidden" name="groupId" value={groupId} />
              <input type="hidden" name="optionId" value={option.id} />

              <div className="grid gap-3 sm:grid-cols-[1fr_100px_90px]">
                <div>
                  <label className="label" htmlFor={`option-name-${option.id}`}>
                    Nome
                  </label>
                  <input
                    id={`option-name-${option.id}`}
                    name="name"
                    defaultValue={option.name}
                    className="input"
                    maxLength={60}
                    required
                  />
                  <FieldError messages={updateState.fieldErrors?.["name"]} />
                </div>

                <div>
                  <label className="label" htmlFor={`option-price-${option.id}`}>
                    Preço (R$)
                  </label>
                  <input
                    id={`option-price-${option.id}`}
                    name="price"
                    defaultValue={centsToInputValue(option.priceCents)}
                    className="input"
                    inputMode="decimal"
                  />
                  <FieldError messages={updateState.fieldErrors?.["price"]} />
                </div>

                <div>
                  <label className="label" htmlFor={`option-order-${option.id}`}>
                    Ordem
                  </label>
                  <input
                    id={`option-order-${option.id}`}
                    name="sortOrder"
                    type="number"
                    min={0}
                    max={9999}
                    defaultValue={option.sortOrder}
                    className="input"
                  />
                  <FieldError messages={updateState.fieldErrors?.["sortOrder"]} />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  name="isAvailable"
                  defaultChecked={option.isAvailable}
                  className="h-4 w-4 accent-cactus"
                />
                Disponível
              </label>

              <FormFeedback state={updateState} />

              <SubmitButton pending={updating} className="btn btn-primary text-xs">
                Salvar adicional
              </SubmitButton>
            </form>

            <form
              action={deleteAction}
              onSubmit={(event) => {
                if (!window.confirm(`Remover o adicional "${option.name}"?`)) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="productId" value={productId} />
              <input type="hidden" name="groupId" value={groupId} />
              <input type="hidden" name="optionId" value={option.id} />
              <SubmitButton
                pending={deleting}
                pendingLabel="Removendo…"
                className="text-xs font-semibold text-terracotta underline underline-offset-2 disabled:opacity-60"
              >
                Remover adicional
              </SubmitButton>
            </form>
            <FormFeedback state={deleteState} />
          </div>
        </details>
      </div>
    </li>
  );
}

function CreateOptionForm({ productId, groupId }: { productId: string; groupId: string }) {
  const [state, formAction, pending] = useActionState(createModifierOptionAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <details>
      <summary className="cursor-pointer text-sm font-semibold">Adicionar opção</summary>

      <form ref={formRef} action={formAction} className="mt-3 space-y-3">
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="groupId" value={groupId} />

        <div className="grid gap-3 sm:grid-cols-[1fr_100px_90px]">
          <div>
            <label className="label" htmlFor={`new-option-name-${groupId}`}>
              Nome
            </label>
            <input
              id={`new-option-name-${groupId}`}
              name="name"
              className="input"
              maxLength={60}
              placeholder="Ex.: Torresminho"
              required
            />
            <FieldError messages={state.fieldErrors?.["name"]} />
          </div>

          <div>
            <label className="label" htmlFor={`new-option-price-${groupId}`}>
              Preço (R$)
            </label>
            <input
              id={`new-option-price-${groupId}`}
              name="price"
              className="input"
              inputMode="decimal"
              placeholder="0,00"
            />
            <FieldError messages={state.fieldErrors?.["price"]} />
          </div>

          <div>
            <label className="label" htmlFor={`new-option-order-${groupId}`}>
              Ordem
            </label>
            <input
              id={`new-option-order-${groupId}`}
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

        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" name="isAvailable" defaultChecked className="h-4 w-4 accent-cactus" />
          Disponível
        </label>

        <FormFeedback state={state} />

        <SubmitButton pending={pending} className="btn btn-secondary text-xs">
          Adicionar opção
        </SubmitButton>
      </form>
    </details>
  );
}
