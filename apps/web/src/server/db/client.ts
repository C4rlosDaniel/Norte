import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * O pooler do Supabase em modo transaction não suporta prepared statements.
 * Por isso `prepare: false` e um pool pequeno (o worker divide a mesma instância).
 */
export function createDb(url: string) {
  const client = postgres(url, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return drizzle(client, { schema });
}

/** Cliente real (postgres-js). Use casos de teste com PGlite quando precisar de isolamento. */
export type Db = ReturnType<typeof createDb>;

const globalForDb = globalThis as unknown as { __norteDb?: Db };

/** Singleton por processo (evita vazar conexões no hot reload do `next dev`). */
export function getDb(): Db {
  if (!globalForDb.__norteDb) {
    const url = process.env["DATABASE_URL"];
    if (!url) {
      throw new Error(
        "DATABASE_URL não configurada. Copie apps/web/.env.example para apps/web/.env.local.",
      );
    }
    globalForDb.__norteDb = createDb(url);
  }
  return globalForDb.__norteDb;
}

export { schema };
