"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getClientAuth } from "@/lib/firebase/client";
import { signOut } from "firebase/auth";
import { useEffect, useState } from "react";
import { obterPerfilSessao } from "@/server/actions";
import type { Perfil } from "@/lib/types";

const LINKS = [
  ["/", "Início"], ["/efetivo", "Efetivo"], ["/elogios", "Elogios"], ["/laureas", "Láureas"], ["/relatorios", "Relatórios"], ["/admin", "Administração"],
] as const;

export function Nav() {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  useEffect(() => { obterPerfilSessao().then(s => setPerfil(s?.perfil ?? null)).catch(() => {}); }, []);
  if (path === "/login") return null;

  const links = LINKS.filter(([h]) => h !== "/admin" || perfil === "admin");

  async function sair() {
    await signOut(getClientAuth());
    await fetch("/api/session", { method: "DELETE" });
    router.push("/login");
  }

  return (
    <header className="bg-[#1f3a5f] text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold tracking-wide">
          Controle de Láureas <span className="text-[#c9a227]">— Equipe B</span>
        </Link>
        <button aria-label="Abrir menu" className="md:hidden rounded px-3 py-1 border border-white/30" onClick={() => setOpen(!open)}>☰</button>
        <nav className="hidden gap-4 md:flex items-center">
          {links.map(([h, l]) => (
            <Link key={h} href={h} className={`text-sm hover:text-[#c9a227] ${path === h ? "text-[#c9a227]" : ""}`}>{l}</Link>
          ))}
          <button onClick={sair} className="text-sm underline underline-offset-2 hover:text-[#c9a227]">Sair</button>
        </nav>
      </div>
      {open && (
        <nav className="md:hidden border-t border-white/10 px-4 py-2 flex flex-col gap-2">
          {links.map(([h, l]) => (
            <Link key={h} href={h} onClick={() => setOpen(false)} className={`py-1 ${path === h ? "text-[#c9a227]" : ""}`}>{l}</Link>
          ))}
          <button onClick={sair} className="text-left py-1 underline">Sair</button>
        </nav>
      )}
    </header>
  );
}
