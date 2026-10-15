"use client";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [escuro, setEscuro] = useState<boolean | null>(null);

  useEffect(() => {
    setEscuro(document.documentElement.classList.contains("dark"));
  }, []);

  function alternar() {
    const novo = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", novo);
    try { localStorage.setItem("tema", novo ? "escuro" : "claro"); } catch {}
    setEscuro(novo);
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label="Alternar tema"
      title={escuro ? "Modo claro" : "Modo escuro"}
      className="flex h-11 w-11 items-center justify-center rounded text-lg hover:bg-white/10"
    >
      {escuro === null ? "◐" : escuro ? "☀️" : "🌙"}
    </button>
  );
}
