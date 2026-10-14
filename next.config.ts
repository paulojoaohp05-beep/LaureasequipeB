import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Todas as páginas são autenticadas/dinâmicas; Cache Components desativado.
  cacheComponents: false,
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
