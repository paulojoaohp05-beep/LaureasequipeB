import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Todas as páginas são autenticadas/dinâmicas; Cache Components desativado.
  cacheComponents: false,
  // Importações de planilha (até 5 MB em base64) superam o padrão de 1 MB.
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
