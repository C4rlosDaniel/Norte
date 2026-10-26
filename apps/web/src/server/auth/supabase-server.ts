import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getEnv } from "@/server/env";

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * A sessão vive em cookies HTTP-only; a chave anon nunca é enviada ao browser.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const env = getEnv();

  return createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components não podem escrever cookies.
          // O refresh acontece no proxy.ts; a leitura continua válida nesta requisição.
        }
      },
    },
  });
}
