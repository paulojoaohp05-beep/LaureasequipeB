"use client";
import { useEffect, useState } from "react";

export function ConfirmarExclusao({ aberto, titulo, descricao, onConfirmar, onCancelar, pending }: {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  onConfirmar: (motivo: string) => void;
  onCancelar: () => void;
  pending?: boolean;
}) {
  const [motivo, setMotivo] = useState("");
  const [confirma, setConfirma] = useState("");

  useEffect(() => {
    if (aberto) { setMotivo(""); setConfirma(""); }
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onCancelar(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, onCancelar]);

  if (!aberto) return null;
  const habilitado = motivo.trim().length > 0 && confirma.trim().toLowerCase() === "deletar";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancelar}>
      <div role="dialog" aria-modal="true" aria-label={titulo}
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
        onClick={e => e.stopPropagation()}>
        <h2 className="font-semibold text-[#1f3a5f]">{titulo}</h2>
        {descricao && <p className="mt-2 text-sm text-slate-600">{descricao}</p>}
        <label className="mt-4 block text-sm">Motivo da exclusão
          <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3} required
            className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5" />
        </label>
        <label className="mt-3 block text-sm">Digite <strong>DELETAR</strong> para confirmar
          <input value={confirma} onChange={e => setConfirma(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5" />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancelar} className="rounded border border-slate-300 px-4 py-1.5 text-sm">Cancelar</button>
          <button type="button" disabled={!habilitado || pending} onClick={() => onConfirmar(motivo.trim())}
            className="rounded bg-red-700 px-4 py-1.5 text-sm text-white disabled:opacity-50">
            {pending ? "Excluindo…" : "Excluir definitivamente do módulo"}
          </button>
        </div>
      </div>
    </div>
  );
}
