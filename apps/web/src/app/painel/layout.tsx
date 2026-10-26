import { LogOut } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { requireMember } from "@/server/auth/require-member";
import { getDb } from "@/server/db/client";
import { evaluateOpenState } from "@/server/restaurant/business-hours";
import { getRestaurantSnapshot } from "@/server/restaurant/queries";
import { logoutAction } from "./actions";
import { PanelNav } from "./panel-nav";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember();
  const snapshot = await getRestaurantSnapshot(getDb(), member.restaurantId);

  const state = snapshot
    ? evaluateOpenState({
        hours: snapshot.hours,
        now: new Date(),
        timeZone: snapshot.restaurant.timezone,
        manuallyClosed: snapshot.settings.isManuallyClosed,
        deliveryEnabled: snapshot.settings.deliveryEnabled,
      })
    : null;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-leather/15 bg-paper px-4 py-4 lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="mb-5 space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-terracotta">Painel</p>
          <p className="font-display text-lg leading-tight">{member.restaurantName}</p>
        </div>

        <PanelNav />

        <div className="mt-6 space-y-3 border-t border-leather/10 pt-4 text-sm">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-ink-soft">Sessão</p>
            <p className="truncate font-medium">{member.email ?? member.userId}</p>
            <p className="text-xs text-ink-soft">Perfil: {member.role === "owner" ? "proprietário" : "equipe"}</p>
          </div>

          <form action={logoutAction}>
            <button type="submit" className="btn btn-secondary w-full text-xs">
              <LogOut aria-hidden className="h-3.5 w-3.5" />
              Sair
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-leather/15 bg-paper/60 px-5 py-3">
          <div className="flex items-center gap-3">
            {state ? <StatusBadge state={state} /> : null}
            <span className="text-sm text-ink-soft">
              {snapshot ? `Fuso ${snapshot.restaurant.timezone}` : "Configuração incompleta"}
            </span>
          </div>
        </header>

        <main className="flex-1 px-5 py-6">{children}</main>
      </div>
    </div>
  );
}
