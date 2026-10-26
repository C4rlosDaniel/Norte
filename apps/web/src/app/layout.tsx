import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Cardápio e pedidos",
    template: "%s · Cardápio",
  },
  description: "Cardápio web com pedido automático, confirmação no WhatsApp e impressão na cozinha.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
