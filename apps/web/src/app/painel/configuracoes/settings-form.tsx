"use client";

import { useActionState } from "react";

import type { SettingsForPanel } from "@/server/restaurant/members";
import { centsToInputValue } from "@/server/money";
import { saveSettingsAction, type SettingsFormState } from "./actions";

const initialState: SettingsFormState = { status: "idle" };

function FieldError({ messages }: { messages?: string[] | undefined }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs font-medium text-terracotta">{messages[0]}</p>;
}

export function SettingsForm({ settings }: { settings: SettingsForPanel }) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, initialState);

  return (
    <form action={formAction} className="card space-y-5 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="phone">
            Telefone do restaurante
          </label>
          <input
            id="phone"
            name="phone"
            defaultValue={settings.phone}
            className="input"
            placeholder="(11) 99999-9999"
            inputMode="tel"
          />
          <FieldError messages={state.fieldErrors?.["phone"]} />
        </div>

        <div>
          <label className="label" htmlFor="deliveryFee">
            Taxa de entrega (R$)
          </label>
          <input
            id="deliveryFee"
            name="deliveryFee"
            defaultValue={centsToInputValue(settings.deliveryFeeCents)}
            className="input"
            inputMode="decimal"
            placeholder="5,00"
          />
          <p className="mt-1 text-xs text-ink-soft">
            Use vírgula para centavos. Mínimo de R$ 5,00 quando a entrega está ativa.
          </p>
          <FieldError messages={state.fieldErrors?.["deliveryFee"]} />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="addressLine">
          Endereço
        </label>
        <input
          id="addressLine"
          name="addressLine"
          defaultValue={settings.addressLine}
          className="input"
          placeholder="Rua, número — bairro, cidade"
        />
        <FieldError messages={state.fieldErrors?.["addressLine"]} />
      </div>

      <div>
        <label className="label" htmlFor="closedMessage">
          Mensagem quando estiver fechado
        </label>
        <textarea
          id="closedMessage"
          name="closedMessage"
          defaultValue={settings.closedMessage}
          className="input min-h-24"
          maxLength={500}
        />
        <p className="mt-1 text-xs text-ink-soft">
          Será enviada no WhatsApp fora do horário a partir da Fase 5.
        </p>
        <FieldError messages={state.fieldErrors?.["closedMessage"]} />
      </div>

      <div className="space-y-3 rounded-lg bg-kraft/60 p-4">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="deliveryEnabled"
            defaultChecked={settings.deliveryEnabled}
            className="mt-0.5 h-4 w-4 accent-cactus"
          />
          <span>
            <span className="font-semibold">Aceitar entrega</span>
            <span className="block text-xs text-ink-soft">
              Desligado, somente retirada no balcão (e o cardápio não cobra taxa).
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="isManuallyClosed"
            defaultChecked={settings.isManuallyClosed}
            className="mt-0.5 h-4 w-4 accent-terracotta"
          />
          <span>
            <span className="font-semibold">Fechar o restaurante agora</span>
            <span className="block text-xs text-ink-soft">
              Tem prioridade sobre o horário de funcionamento. Afeta o cardápio e a resposta do
              WhatsApp.
            </span>
          </span>
        </label>
      </div>

      {state.status === "error" && state.message ? (
        <p
          role="alert"
          className="rounded-lg border border-terracotta/40 bg-terracotta/10 px-3 py-2 text-sm font-medium text-terracotta"
        >
          {state.message}
        </p>
      ) : null}

      {state.status === "success" && state.message ? (
        <p
          role="status"
          className="rounded-lg border border-cactus/40 bg-cactus/10 px-3 py-2 text-sm font-medium text-cactus"
        >
          {state.message}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Salvando…" : "Salvar configurações"}
        </button>
        <span className="text-xs text-ink-soft">Todas as alterações são validadas no servidor.</span>
      </div>
    </form>
  );
}
