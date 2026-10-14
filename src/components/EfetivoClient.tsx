"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatBR } from "@/lib/dates";
import { criarMembro, editarMembro, excluirMembro } from "@/server/actions";
import type { Integrante, ComplementoEfetivo, Perfil } from "@/lib/types";

type Item = Integrante & {
  complemento: ComplementoEfetivo | null;
  totalElogiosPublicados: number | null;
  laureaVigente: { grau: string; data: string } | null;
};

const GRADUACOES = ["CAP PM", "1º TEN PM", "2º TEN PM", "SUBTEN PM", "1º SGT PM", "2º SGT PM", "3º SGT PM", "CB PM", "SD PM"];

export function EfetivoClient({ itens, perfil }: { itens: Item[]; perfil: Perfil }) {
  const [q, setQ] = useState("");
  const [fSituacao, setFSituacao] = useState("");
  const [fGrad, setFGrad] = useState("");
  const [pendentes, setPendentes] = useState(false);
  const [editando, setEditando] = useState<Item | null | "novo">(null);
  const [erro, setErro] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const sp = useSearchParams();
  const mostrarExcluidos = sp.get("excluidos") === "1";
  const podeGerenciar = perfil === "admin" || perfil === "gestor";

  const graduacoes = [...new Set(itens.map(i => i.graduacao))];
  const lista = useMemo(() => itens.filter(i => {
    const t = q.toLowerCase();
    const okQ = !t || i.nome.toLowerCase().includes(t) || i.re.toLowerCase().includes(t) || i.graduacao.toLowerCase().includes(t);
    const okS = !fSituacao || (i.situacao ?? "ativo") === fSituacao;
    const okG = !fGrad || i.graduacao === fGrad;
    const okP = !pendentes || (i.complemento?.camposPendentes?.length ?? 0) > 0;
    return okQ && okS && okG && okP;
  }), [itens, q, fSituacao, fGrad, pendentes]);

  function salvar(fd: FormData) {
    setErro("");
    const dados = {
      re: String(fd.get("re") ?? ""), nome: String(fd.get("nome") ?? ""),
      graduacao: String(fd.get("graduacao") ?? ""), nomeGuerra: String(fd.get("nomeGuerra") ?? "") || undefined,
      ingressoPM: String(fd.get("ingressoPM") ?? "") || undefined,
      ingressoEquipe: String(fd.get("ingressoEquipe") ?? "") || undefined,
    };
    start(async () => {
      try {
        if (editando === "novo") await criarMembro(dados as { re: string; nome: string; graduacao: string });
        else if (editando) await editarMembro(editando.id, { ...dados, situacaoEquipe: String(fd.get("situacaoEquipe") ?? "") || undefined });
        setEditando(null);
        router.refresh();
      } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao salvar"); }
    });
  }

  function excluir(i: Item) {
    const motivo = prompt(`Motivo da exclusão de ${i.nome}:`) ?? "";
    if (!motivo.trim()) return;
    start(async () => {
      try { await excluirMembro(i.id, motivo); router.refresh(); }
      catch (e) { setErro(e instanceof Error ? e.message : "Erro"); }
    });
  }

  function toggleExcluidos(on: boolean) {
    router.push(on ? "/efetivo?excluidos=1" : "/efetivo");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-stretch gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="text-sm flex-1 min-w-48">Buscar
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Nome, RE ou graduação"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5" />
        </label>
        <label className="text-sm">Situação
          <select value={fSituacao} onChange={e => setFSituacao(e.target.value)} className="mt-1 block rounded border border-slate-300 px-2 py-1.5">
            <option value="">Todas</option><option value="ativo">Ativo</option><option value="afastado">Afastado</option><option value="transferido">Transferido</option><option value="reserva">Reserva</option>{mostrarExcluidos && <option value="excluido">Excluído</option>}
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
        {podeGerenciar && (
          <>
            <label className="flex items-end gap-2 pb-1.5 text-sm">
              <input type="checkbox" checked={mostrarExcluidos} onChange={e => toggleExcluidos(e.target.checked)} /> Mostrar excluídos
            </label>
            <button onClick={() => setEditando("novo")} className="rounded bg-[#1f3a5f] px-4 py-1.5 text-sm text-white">Adicionar integrante</button>
          </>
        )}
      </div>

      {erro && <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {editando && (
        <form action={salvar} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-3">
          <h2 className="font-semibold text-[#1f3a5f] md:col-span-3">{editando === "novo" ? "Novo integrante" : `Editar ${editando.nome}`}</h2>
          <label className="text-sm">Graduação
            <select name="graduacao" required defaultValue={editando === "novo" ? "CB PM" : editando.graduacao} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5">
              {GRADUACOES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
          <label className="text-sm">RE
            <input name="re" required defaultValue={editando === "novo" ? "" : editando.re} className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 font-mono" />
          </label>
          <label className="text-sm">Nome
            <input name="nome" required defaultValue={editando === "novo" ? "" : editando.nome} className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5" />
          </label>
          <label className="text-sm">Nome de guerra
            <input name="nomeGuerra" defaultValue={editando === "novo" ? "" : editando.nomeGuerra ?? ""} className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5" />
          </label>
          <label className="text-sm">Ingresso na PM
            <input name="ingressoPM" type="date" defaultValue={editando === "novo" ? "" : editando.ingressoPM ?? ""} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" />
          </label>
          <label className="text-sm">Ingresso na equipe
            <input name="ingressoEquipe" type="date" defaultValue={editando === "novo" ? "" : editando.complemento?.ingressoEquipe ?? ""} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" />
          </label>
          {editando !== "novo" && (
            <label className="text-sm">Situação na equipe
              <select name="situacaoEquipe" defaultValue={editando.complemento?.situacaoEquipe ?? "ativo"} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5">
                <option value="ativo">Ativo</option><option value="afastado">Afastado</option><option value="transferido">Transferido</option><option value="reserva">Reserva</option>
              </select>
            </label>
          )}
          <div className="flex items-end gap-2 md:col-span-3">
            <button disabled={pending} className="rounded bg-[#1f3a5f] px-4 py-1.5 text-sm text-white disabled:opacity-60">{pending ? "Salvando…" : "Salvar"}</button>
            <button type="button" onClick={() => setEditando(null)} className="rounded border border-slate-300 px-4 py-1.5 text-sm">Cancelar</button>
          </div>
        </form>
      )}

      <p className="text-sm text-slate-600">{lista.length} integrante(s)</p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="mobile-cards w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr><th className="px-3 py-2">Graduação</th><th className="px-3 py-2">RE</th><th className="px-3 py-2">Nome</th><th className="px-3 py-2">Elogios</th><th className="px-3 py-2">Láurea</th><th className="px-3 py-2">Ingresso equipe</th><th className="px-3 py-2">Situação</th>{podeGerenciar && <th className="px-3 py-2">Ações</th>}</tr>
          </thead>
          <tbody>
            {lista.map(i => (
              <tr key={i.id} onClick={() => router.push(`/efetivo/${i.id}`)} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50">
                <td data-label="Graduação" className="px-3 py-2">{i.graduacao}</td>
                <td data-label="RE" className="px-3 py-2 font-mono">{i.re}</td>
                <td data-label="Nome" className="px-3 py-2">{i.nome}{i.nomeGuerra ? ` (${i.nomeGuerra})` : ""}</td>
                <td data-label="Elogios" className="px-3 py-2">{i.totalElogiosPublicados === null ? <span className="text-xs text-slate-400">sem registro</span> : i.totalElogiosPublicados}</td>
                <td data-label="Láurea" className="px-3 py-2">{i.laureaVigente ? <>{i.laureaVigente.grau} <span className="text-xs text-slate-500">({formatBR(i.laureaVigente.data)})</span></> : <span className="text-xs text-slate-400">sem registro</span>}</td>
                <td data-label="Ingresso equipe" className="px-3 py-2">{formatBR(i.complemento?.ingressoEquipe)}{!i.complemento?.ingressoEquipe && <span className="text-xs text-amber-700"> pendente</span>}</td>
                <td data-label="Situação" className="px-3 py-2">{i.situacao ?? "ativo"}</td>
                {podeGerenciar && (
                  <td data-label="Ações" className="px-3 py-2 space-x-2" onClick={e => e.stopPropagation()}>
                    {i.situacao !== "excluido" && <>
                      <button onClick={() => setEditando(i)} className="text-xs text-[#1f3a5f] underline">Editar</button>
                      <button onClick={() => excluir(i)} className="text-xs text-red-700 underline">Excluir</button>
                    </>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
