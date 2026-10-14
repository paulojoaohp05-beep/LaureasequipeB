import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { NavServer } from "@/components/NavServer";

export const metadata: Metadata = {
  title: "Controle de Láureas — Equipe B",
  description: "Controle de efetivo, elogios e láureas da Equipe B",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <Suspense fallback={<Nav perfil={null} />}>
          <NavServer />
        </Suspense>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
