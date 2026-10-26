import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "@/server/db/schema";
import type { Db } from "@/server/db/types";

export type TestDatabase = {
  db: Db;
  client: PGlite;
};

/**
 * Postgres real (PGlite/WASM) com as MESMAS migrações de produção.
 * Não substitui um teste no Supabase, mas valida SQL, constraints e tipos.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const client = new PGlite();
  const db = drizzle(client, { schema });

  await migrate(db, { migrationsFolder: "drizzle" });

  return { db: db as unknown as Db, client };
}
