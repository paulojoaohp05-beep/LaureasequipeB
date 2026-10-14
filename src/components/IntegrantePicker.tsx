"use client";
// Campo de busca de integrante com filtro ao digitar (nome, nome de guerra, RE ou graduação).
// `multi=false` → seleção única via <input type=hidden name>. `multi=true` → chips acumulativos
// emitindo vários valores no mesmo name (FormData.getAll).
import { useMemo, useRef, useState } from "react";
import type { Integrante } from "@/lib/types";

export function IntegrantePicker({ name, integrantes, multi = false, required = false, placeholder = "Digite nome ou RE…" }: {
  name: string; integrantes: Integrante[]; multi?: boolean; required?: boolean; placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [aberto, setAberto] = useState(false);
  const [sel, setSel] = useState<Integrante[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return integrantes.slice(0, 30);
    return integrantes.filter(i =>
      i.nome.toLowerCase().includes(t) || i.re.toLowerCase().includes(t) ||
      (i.nomeGuerra ?? "").toLowerCase().includes(t) || i.graduacao.toLowerCase().includes(t)
    ).slice(0, 30);
  }, [q, integrantes]);

  function escolher(i: Integrante) {
    if (multi) { if (!sel.some(s => s.id === i.id)) setSel([...sel, i]); setQ(""); }
    else { setSel([i]); setQ(`${i.graduacao} ${i.nomeGuerra || i.nome}`); }
    setAberto(false);
  }

  return (
    <div ref={ref} className="relative">
      {/* valores submetidos */}
      {multi
        ? sel.map(s => <input key={s.id} type="hidden" name={name} value={s.id} />)
        : <input type="hidden" name={name} value={sel[0]?.id ?? ""} required={required} />}

      <input value={q} placeholder={placeholder} autoComplete="off" aria-required={required}
        onFocus={() => setAberto(true)}
        onChange={e => { setQ(e.target.value); setAberto(true); if (!multi) setSel([]); }}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        className="w-full rounded border border-slate-300 px-3 py-2" />

      {aberto && (
        <ul className="absolute z-50 mt-1 max-h-[min(14rem,50vh)] w-full min-w-0 overflow-y-auto overscroll-contain rounded border border-slate-300 bg-white shadow-lg">
          {filtrados.map(i => (
            <li key={i.id}>
              <button type="button" onPointerDown={e => { e.preventDefault(); escolher(i); }}
                className="w-full px-3 py-2.5 text-left text-sm hover:bg-slate-100">
                {i.graduacao} {i.nomeGuerra || i.nome} <span className="font-mono text-xs text-slate-500">RE {i.re}</span>
              </button>
            </li>
          ))}
          {filtrados.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">Nenhum resultado</li>}
        </ul>
      )}

      {multi && sel.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {sel.map(s => (
            <span key={s.id} className="flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs">
              {s.graduacao} {s.nomeGuerra || s.nome}
              <button type="button" aria-label="Remover" onClick={() => setSel(sel.filter(x => x.id !== s.id))} className="text-slate-500 hover:text-red-600">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
