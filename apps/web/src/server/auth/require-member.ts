import { redirect } from "next/navigation";

import { getDb } from "@/server/db/client";
import { findMember } from "@/server/restaurant/members";
import { getSessionUser } from "@/server/auth/session";

export type AuthenticatedMember = {
  userId: string;
  email: string | null;
  restaurantId: string;
  restaurantSlug: string;
  restaurantName: string;
  restaurantTimezone: string;
  role: "owner" | "staff";
};

/**
 * Guarda de autorização usada por toda página/action do painel.
 * Sem sessão -> /login. Sessão sem vínculo -> /login?erro=sem-acesso.
 */
export async function requireMember(): Promise<AuthenticatedMember> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const member = await findMember(getDb(), user.id);
  if (!member) redirect("/login?erro=sem-acesso");

  return { ...member, email: user.email };
}
