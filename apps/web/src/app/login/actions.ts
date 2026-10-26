"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseServerClient } from "@/server/auth/supabase-server";
import { log } from "@/server/logger";

const loginSchema = z.object({
  email: z.email("E-mail inválido").max(200),
  password: z.string().min(1, "Informe a senha").max(200),
});

export type LoginState = { error: string | null };

/** Só aceita caminho interno — impede open redirect via ?next=. */
function safeNextPath(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/painel";
  if (!value.startsWith("/") || value.startsWith("//")) return "/painel";
  return value;
}

export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { error: "Informe e-mail e senha." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Não revelamos se o e-mail existe ou não.
    log("warn", "auth.login_failed", { code: error.code ?? "unknown" });
    return { error: "E-mail ou senha incorretos." };
  }

  log("info", "auth.login_succeeded");
  redirect(safeNextPath(formData.get("next")));
}
