"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatBR } from "@/lib/dates";
import type { Integrante, ComplementoEfetivo } from "@/lib/types";

type Item = Integrante & { complemento: ComplementoEfetivo | null };

export function EfetivoClient({ itens }: { itens: Item[] }) {
  const [q, setQ] = useState("");
  const [fSituacao, setFSituacao] = useState("");
  const [fGrad, setFGrad] = useState("");
  const [pendentes, setPendentes] = useState(false);
  const router = useRouter();

  const graduacoes = [...new Set(itens.map(i => i.graduacao))];
  const lista = useMemo(() => itens.filter(i => {
    const t = q.toLowerCase();
    const okQ = !t || i.nome.toLowerCase().includes(t) || i.re.toLowerCase().includes(t) || (i.funcao ?? "").toLowerCase().includes(t) || i.graduacao.toLowerCase().includes(t);
    const okS = !fSituacao || (i.situacao ?? "ativo") === fSituacao;
    const okG = !fGrad || i.graduacao === fGrad;
    const okP = !pendentes || (i.complemento?.camposPendentes?.length ?? 0) > 0;
    return okQ && okS && okG && okP;
  }), [itens, q, fSituacao, fGrad, pendentes]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="text-sm flex-1 min-w-48">Buscar
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Nome, RE, graduação ou função"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5" />
        </label>
        <label className="text-sm">Situação
          <select value={fSituacao} onChange={e => setFSituacao(e.target.value)} className="mt-1 block rounded border border-slate-300 px-2 py-1.5">
            <option value="">Todas</option><option value="ativo">Ativo</option><option value="afastado">Afastado</option><option value="transferido">Transferido</option><option value="reserva">Reserva</option>
          </select>
        </label>
        <label className="text-sm">Graduação
          <select value={fGrad} onChange={e => setFGrad(e.target.value)} className="mt-1 block rounded border border-slate-300 px-2 py-1.5">
            <option value="">Todas</option>{graduacoes.map(g => <option key={g}>{g}</option>)}
          </select>
        </label>
        <label className="flex items-end gap-2 pb-1.5 text-sm">
          <input type="checkbox" checked={pendentes} onChange={e => setPendentes(e.target.checked)} /> Com informação pendente
        </label>
      </div>

      <p className="text-sm text-slate-600">{lista.length} integrante(s)</p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr><th className="px-3 py-2">Graduação</th><th className="px-3 py-2">RE</th><th className="px-3 py-2">Nome</th><th className="px-3 py-2">Função</th><th className="px-3 py-2">Ingresso equipe</th><th className="px-3 py-2">Situação</th></tr>
          </thead>
          <tbody>
            {lista.map(i => (
              <tr key={i.id} onClick={() => router.push(`/efetivo/${i.id}`)} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2">{i.graduacao}</td>
                <td className="px-3 py-2 font-mono">{i.re}</td>
                <td className="px-3 py-2">{i.nome}{i.nomeGuerra ? ` (${i.nomeGuerra})` : ""}</td>
                <td className="px-3 py-2">{i.funcao || "—"}</td>
                <td className="px-3 py-2">{formatBR(i.complemento?.ingressoEquipe)}{!i.complemento?.ingressoEquipe && <span className="text-xs text-amber-700"> pendente</span>}</td>
                <td className="px-3 py-2">{i.situacao ?? "ativo"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
