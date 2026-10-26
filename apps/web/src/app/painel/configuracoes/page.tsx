import { requireMember } from "@/server/auth/require-member";
import { getDb } from "@/server/db/client";
import { WEEKDAY_LABELS, parseTimeToMinutes } from "@/server/restaurant/business-hours";
import { getRestaurantSnapshot } from "@/server/restaurant/queries";
import { formatBRL } from "@/server/money";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Configurações" };

export const dynamic = "force-dynamic";

function formatTime(value: string): string {
  const minutes = parseTimeToMinutes(value);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export default async function SettingsPage() {
  const member = await requireMember();
  const snapshot = await getRestaurantSnapshot(getDb(), member.restaurantId);

  if (!snapshot) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl">Configurações</h1>
        <p className="card p-6 text-sm text-ink-soft">
          Este restaurante não tem configurações cadastradas. Rode o seed do ambiente para criar os
          valores iniciais.
        </p>
      </div>
    );
  }

  const { restaurant, settings, hours } = snapshot;
  const byWeekday = new Map<number, typeof hours>();
  for (const row of hours) {
    const current = byWeekday.get(row.weekday) ?? [];
    current.push(row);
    byWeekday.set(row.weekday, current);
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl">Configurações</h1>
        <p className="text-sm text-ink-soft">
          {restaurant.name} · fuso {restaurant.timezone} · taxa atual{" "}
          {formatBRL(settings.deliveryFeeCents)}
        </p>
      </header>

      <SettingsForm settings={settings} />

      <section className="card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl">Horário de funcionamento</h2>
          <span className="text-xs text-ink-soft">Somente leitura nesta fase</span>
        </div>

        <ul className="divide-y divide-leather/10 text-sm">
          {WEEKDAY_LABELS.map((label, weekday) => {
            const rows = byWeekday.get(weekday) ?? [];
            const open = rows.filter((row) => !row.isClosed);

            return (
              <li key={label} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-semibold capitalize">{label}</span>
                {open.length === 0 ? (
                  <span className="text-ink-soft">Fechado</span>
                ) : (
                  <span className="flex flex-wrap gap-x-3 gap-y-1 text-right">
                    {open.map((row) => (
                      <span key={row.id}>
                        {formatTime(row.opensAt)}–{formatTime(row.closesAt)}
                        {row.acceptsDeliveryUntil ? (
                          <span className="text-ink-soft">
                            {" "}
                            · entrega até {formatTime(row.acceptsDeliveryUntil)}
                          </span>
                        ) : null}
                      </span>
                    ))}
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <p className="mt-4 text-xs text-ink-soft">
          Edição de horários, formas de pagamento, mensagens automáticas e status do WhatsApp entram
          nas próximas fases.
        </p>
      </section>
    </div>
  );
}
