"use client";

import { useFormStatus } from "react-dom";

import type { MenuFormState } from "./actions";

export function FieldError({ messages }: { messages?: string[] | undefined }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs font-medium text-terracotta">{messages[0]}</p>;
}

export function FormFeedback({ state }: { state: MenuFormState }) {
  if (state.status === "error" && state.message) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-terracotta/40 bg-terracotta/10 px-3 py-2 text-sm font-medium text-terracotta"
      >
        {state.message}
      </p>
    );
  }

  if (state.status === "success" && state.message) {
    return (
      <p
        role="status"
        className="rounded-lg border border-cactus/40 bg-cactus/10 px-3 py-2 text-sm font-medium text-cactus"
      >
        {state.message}
      </p>
    );
  }

  return null;
}

export function SubmitButton({
  pending,
  children,
  pendingLabel = "Salvando…",
  className = "btn btn-primary",
}: {
  pending: boolean;
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

/** Botão de ação simples (form action sem useActionState) com estado de envio. */
export function PendingButton({
  children,
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
