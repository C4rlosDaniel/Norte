import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import * as schema from "@/server/db/schema";

/** Tipo aceito pelos casos de uso: serve tanto para postgres-js quanto para PGlite (testes). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
