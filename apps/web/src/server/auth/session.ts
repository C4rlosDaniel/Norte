import { cache } from "react";

import { createSupabaseServerClient } from "@/server/auth/supabase-server";

export type SessionUser = {
  id: string;
  email: string | null;
};

/**
 * getUser() valida o token no servidor do Supabase (não confia no cookie).
 * cache() evita repetir a chamada dentro da mesma requisição.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return null;

  return { id: data.user.id, email: data.user.email ?? null };
});
