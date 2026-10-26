import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O app é dinâmico por natureza (banco de dados, sessão, filas).
  // Cache Components fica desligado nesta fase para manter o modelo mental simples.
  cacheComponents: false,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
