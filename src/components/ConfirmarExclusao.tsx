"use client";
import { useEffect, useRef, useState } from "react";

export function ConfirmarExclusao({ aberto, titulo, onConfirmar, onCancelar, pending }: {
  aberto: boolean;
  titulo: string;
  onConfirmar: () => void;
  onCancelar: () => void;
  pending?: boolean;
}) {
  const [confirma, setConfirma] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (aberto) { setConfirma(""); setTimeout(() => inputRef.current?.focus(), 0); }
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onCancelar(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, onCancelar]);

  if (!aberto) return null;
  const habilitado = confirma.trim().toLowerCase() === "deletar";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancelar}>
      <div role="dialog" aria-modal="true" aria-label={titulo}
        className="w-full max-w-md rounded-lg bg-white dark:bg-slate-900 p-5 shadow-xl"
        onClick={e => e.stopPropagation()}>
        <h2 className="font-semibold text-[#1f3a5f] dark:text-[#8fb3e6]">{titulo}</h2>
        <label className="mt-4 block text-sm">Digite <strong>DELETAR</strong> para confirmar
          <input ref={inputRef} value={confirma} onChange={e => setConfirma(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5" />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancelar} className="rounded border border-slate-300 dark:border-slate-600 px-4 py-1.5 text-sm">Cancelar</button>
          <button type="button" disabled={!habilitado || pending} onClick={onConfirmar}
            className="rounded bg-red-700 px-4 py-1.5 text-sm text-white disabled:opacity-50">
            {pending ? "Excluindo…" : "Excluir"}
          </button>
        </div>
      </div>
    </div>
  );
}
