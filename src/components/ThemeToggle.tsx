"use client";

export function ThemeToggle() {
  function alternar() {
    const novo = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", novo);
    try { localStorage.setItem("tema", novo ? "escuro" : "claro"); } catch {}
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label="Alternar tema"
      title="Alternar tema"
      className="flex h-11 w-11 items-center justify-center rounded text-lg hover:bg-white/10"
    >
      <span className="dark:hidden">🌙</span>
      <span className="hidden dark:inline">☀️</span>
    </button>
  );
}
