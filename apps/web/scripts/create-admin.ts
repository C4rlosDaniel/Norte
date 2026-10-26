import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

import { sql } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";

import { createDb } from "@/server/db/client";
import { restaurantUsers } from "@/server/db/schema";
import { getRestaurantBySlug } from "@/server/restaurant/queries";

/**
 * Libera o acesso do painel para um e-mail.
 *
 * Dois modos:
 * 1. Com SUPABASE_SERVICE_ROLE_KEY + ADMIN_PASSWORD: cria o usuário se não existir.
 * 2. Sem service role: o usuário precisa já existir em Authentication → Users
 *    (criado no painel do Supabase) e é apenas vinculado ao restaurante.
 *
 * Nunca roda no browser nem no deploy.
 */
async function main() {
  const supabaseUrl = process.env["SUPABASE_URL"];
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  const databaseUrl = process.env["DATABASE_URL"];
  const email = process.env["ADMIN_EMAIL"]?.trim().toLowerCase();
  const password = process.env["ADMIN_PASSWORD"];
  const slug = process.env["RESTAURANT_SLUG"] ?? "amigos-do-norte";

  const missing = [
    ["SUPABASE_URL", supabaseUrl],
    ["DATABASE_URL", databaseUrl],
    ["ADMIN_EMAIL", email],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    console.error(`[create-admin] variáveis ausentes: ${missing.join(", ")}`);
    console.error("[create-admin] preencha no .env.local (nunca em arquivo versionado).");
    process.exit(1);
  }

  const db = createDb(databaseUrl!);
  const restaurant = await getRestaurantBySlug(db, slug);
  if (!restaurant) {
    console.error(`[create-admin] restaurante "${slug}" não existe. Rode npm run db:seed primeiro.`);
    process.exit(1);
  }

  let userId: string | undefined;

  if (serviceKey && password) {
    if (password.length < 10) {
      console.error("[create-admin] ADMIN_PASSWORD precisa ter ao menos 10 caracteres.");
      process.exit(1);
    }

    const supabase = createClient(supabaseUrl!, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabase.auth.admin.createUser({
      email: email!,
      password,
      email_confirm: true,
    });

    if (error) {
      if (error.code !== "email_exists" && error.status !== 422) throw error;
      console.log("[create-admin] usuário já existia no Supabase Auth; apenas vinculando.");
    } else {
      userId = data.user?.id;
      console.log(`[create-admin] usuário criado: ${userId}`);
    }
  } else {
    console.log(
      "[create-admin] sem service role: buscando usuário já criado no Supabase Auth (modo somente vínculo).",
    );
  }

  if (!userId) {
    const rows = (await db.execute(
      sql`select id from auth.users where lower(email) = ${email} limit 1`,
    )) as unknown as Array<{ id: string }>;

    userId = rows[0]?.id;
  }

  if (!userId) {
    console.error(`[create-admin] não encontrei o usuário ${email} em auth.users.`);
    console.error(
      "[create-admin] crie em Supabase → Authentication → Users → Add user (marque Auto Confirm),",
    );
    console.error(
      "[create-admin] ou informe SUPABASE_SERVICE_ROLE_KEY e ADMIN_PASSWORD para criar automaticamente.",
    );
    process.exit(1);
  }

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
