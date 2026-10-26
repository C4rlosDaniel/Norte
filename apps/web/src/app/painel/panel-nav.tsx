"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ClipboardList, Settings } from "lucide-react";

const items = [
  { href: "/painel/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/painel/cardapio", label: "Cardápio", icon: BookOpen },
  { href: "/painel/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function PanelNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Seções do painel" className="flex gap-1 overflow-x-auto lg:flex-col">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              active ? "bg-leather text-paper" : "text-leather/80 hover:bg-kraft"
            }`}
          >
            <Icon aria-hidden className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
