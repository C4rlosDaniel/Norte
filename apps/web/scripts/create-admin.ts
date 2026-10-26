import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

import { createClient } from "@supabase/supabase-js";

import { createDb } from "@/server/db/client";
import { restaurantUsers } from "@/server/db/schema";
import { getRestaurantBySlug } from "@/server/restaurant/queries";

/**
 * Cria (ou reutiliza) o usuário de login do painel e o vincula ao restaurante.
 * Requer SUPABASE_SERVICE_ROLE_KEY — nunca deve rodar no browser nem no deploy.
 */
async function main() {
  const supabaseUrl = process.env["SUPABASE_URL"];
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  const databaseUrl = process.env["DATABASE_URL"];
  const email = process.env["ADMIN_EMAIL"];
  const password = process.env["ADMIN_PASSWORD"];
  const slug = process.env["RESTAURANT_SLUG"] ?? "amigos-do-norte";

  const missing = [
    ["SUPABASE_URL", supabaseUrl],
    ["SUPABASE_SERVICE_ROLE_KEY", serviceKey],
    ["DATABASE_URL", databaseUrl],
    ["ADMIN_EMAIL", email],
    ["ADMIN_PASSWORD", password],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    console.error(`[create-admin] variáveis ausentes: ${missing.join(", ")}`);
    console.error("[create-admin] preencha no .env.local (nunca em arquivo versionado).");
    process.exit(1);
  }

  if (password!.length < 10) {
    console.error("[create-admin] ADMIN_PASSWORD precisa ter ao menos 10 caracteres.");
    process.exit(1);
  }

  const db = createDb(databaseUrl!);
  const restaurant = await getRestaurantBySlug(db, slug);
  if (!restaurant) {
    console.error(`[create-admin] restaurante "${slug}" não existe. Rode npm run db:seed primeiro.`);
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl!, serviceKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let userId: string | undefined;

  const { data, error } = await supabase.auth.admin.createUser({
    email: email!,
    password: password!,
    email_confirm: true,
  });

  if (error) {
    if (error.code === "email_exists" || error.status === 422) {
      const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      if (listError) throw listError;
      userId = list.users.find((user) => user.email?.toLowerCase() === email!.toLowerCase())?.id;
      if (!userId) throw new Error("Usuário já existe, mas não foi possível localizá-lo.");
      console.log(`[create-admin] usuário já existia: ${userId}`);
    } else {
      throw error;
    }
  } else {
    userId = data.user?.id;
    console.log(`[create-admin] usuário criado: ${userId}`);
  }

  if (!userId) throw new Error("Não foi possível obter o id do usuário.");

  await db
    .insert(restaurantUsers)
    .values({ userId, restaurantId: restaurant.id, role: "owner" })
    .onConflictDoUpdate({
      target: restaurantUsers.userId,
      set: { restaurantId: restaurant.id, role: "owner", updatedAt: new Date() },
    });

  console.log(`[create-admin] acesso liberado para ${email} no restaurante ${slug}.`);
  console.log("[create-admin] a senha não é exibida nem registrada em log.");
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("[create-admin] falhou:", error);
    process.exit(1);
  });
