import { sql } from "drizzle-orm";

import type { Db } from "@/server/db/types";
import { rateLimits } from "@/server/db/schema";

export type RateLimitResult = {
  allowed: boolean;
  count: number;
  limit: number;
  retryAfterSeconds: number;
};

type ConsumeOptions = {
  bucket: string;
  limit: number;
  windowSeconds: number;
  now?: Date;
};

/**
 * Incremento atômico por janela fixa. O retorno já é o contador atualizado,
 * então duas requisições simultâneas não passam da mesma forma.
 */
export async function consumeRateLimit(
  db: Db,
  { bucket, limit, windowSeconds, now = new Date() }: ConsumeOptions,
): Promise<RateLimitResult> {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((windowStart.getTime() + windowMs - now.getTime()) / 1000),
  );

  const [row] = await db
    .insert(rateLimits)
    .values({ bucket, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.bucket, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });

  const count = row?.count ?? 1;

  return { allowed: count <= limit, count, limit, retryAfterSeconds };
}
