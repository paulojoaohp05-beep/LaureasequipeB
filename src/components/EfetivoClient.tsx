"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatBR, hojeSP } from "@/lib/dates";
import { normalizarCategoria, normalizarSat } from "@/lib/habilitacao";
import { criarMembro, editarMembro, excluirMembro, obterEfetivo } from "@/server/actions";
import { desembrulhar } from "@/lib/acao";
import { calcularMedalha, ROTULO_GRAU } from "@/lib/medalha";
import { ConfirmarExclusao } from "./ConfirmarExclusao";
import { MedalhaBadge } from "./MedalhaBadge";
import type { Perfil } from "@/lib/types";

type Item = Awaited<ReturnType<typeof obterEfetivo>>[number];

const GRADUACOES = ["CAP PM", "1º TEN PM", "2º TEN PM", "SUBTEN PM", "1º SGT PM", "2º SGT PM", "3º SGT PM", "CB PM", "SD PM"];

export function EfetivoClient({ itens, perfil }: { itens: Item[]; perfil: Perfil }) {
  const [q, setQ] = useState("");
  const [fSituacao, setFSituacao] = useState("");
  const [fGrad, setFGrad] = useState("");
  const [fMedalha, setFMedalha] = useState("");
  const [fFazJus, setFFazJus] = useState("");
  const [pendentes, setPendentes] = useState(false);
  const [editando, setEditando] = useState<Item | null | "novo">(null);
  const [excluindo, setExcluindo] = useState<Item | null>(null);
  const [erro, setErro] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const sp = useSearchParams();
  const mostrarExcluidos = sp.get("excluidos") === "1";
  const podeGerenciar = perfil === "admin" || perfil === "gestor";

  const graduacoes = [...new Set(itens.map(i => i.graduacao))];
  const lista = useMemo(() => itens.filter(i => {
    const t = q.toLowerCase();
    const okQ = !t || i.nome.toLowerCase().includes(t) || (i.nomeGuerra ?? "").toLowerCase().includes(t) || i.re.toLowerCase().includes(t) || i.graduacao.toLowerCase().includes(t);
    const okS = !fSituacao || (i.situacao ?? "ativo") === fSituacao;
    const okG = !fGrad || i.graduacao === fGrad;
    const okP = !pendentes || i.pendencias.length > 0;
    const okM = !fMedalha
      || (fMedalha === "pendente" ? (i.medalha.situacao === "pendente" || i.medalha.situacao === "pendente-superior") : i.medalha.situacao === fMedalha);
    const okJ = !fFazJus || i.medalha.devida === fFazJus;
    return okQ && okS && okG && okP && okM && okJ;
  }), [itens, q, fSituacao, fGrad, fMedalha, fFazJus, pendentes]);

  const resumoMedalha = useMemo(() => ({
    pendentes: lista.filter(i => i.medalha.situacao === "pendente" || i.medalha.situacao === "pendente-superior").length,
    recebidas: lista.filter(i => i.medalha.situacao === "em-dia").length,
    semData: lista.filter(i => i.medalha.situacao === "sem-data").length,
  }), [lista]);

  function salvar(fd: FormData) {
    setErro("");
    const dados = {
      re: String(fd.get("re") ?? ""), nome: String(fd.get("nome") ?? ""),
      graduacao: String(fd.get("graduacao") ?? ""), nomeGuerra: String(fd.get("nomeGuerra") ?? "") || undefined,
      ingressoPM: String(fd.get("ingressoPM") ?? "") || undefined,
      ingressoEquipe: String(fd.get("ingressoEquipe") ?? "") || undefined,
      cnh: normalizarCategoria(fd.get("cnh")),
      sat: normalizarSat(fd.get("sat")),
      medalhaRecebida: String(fd.get("medalhaRecebida") ?? ""),
      medalhaRecebidaEm: String(fd.get("medalhaRecebidaEm") ?? ""),
    };
    start(async () => {
      try {
        if (editando === "novo") desembrulhar(await criarMembro(dados as { re: string; nome: string; graduacao: string }));
        else if (editando) desembrulhar(await editarMembro(editando.id, { ...dados, situacaoEquipe: String(fd.get("situacaoEquipe") ?? "") || undefined }));
        setEditando(null);
        router.refresh();
      } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao salvar"); }
    });
  }

  function excluir() {
    if (!excluindo) return;
    start(async () => {
      try { desembrulhar(await excluirMembro(excluindo.id)); setExcluindo(null); router.refresh(); }
      catch (e) { setErro(e instanceof Error ? e.message : "Erro"); }
    });
  }

  function toggleExcluidos(on: boolean) {
    router.push(on ? "/efetivo?excluidos=1" : "/efetivo");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-stretch gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="text-sm flex-1 min-w-48">Buscar
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Nome, nome de guerra, RE ou graduação"
            className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5" />
        </label>
        <label className="text-sm">Situação
          <select value={fSituacao} onChange={e => setFSituacao(e.target.value)} className="mt-1 block rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5">
            <option value="">Todas</option><option value="ativo">Ativo</option><option value="afastado">Afastado</option><option value="transferido">Transferido</option><option value="reserva">Reserva</option>{mostrarExcluidos && <option value="excluido">Excluído</option>}
          </select>
        </label>
        <label className="text-sm">Graduação
          <select value={fGrad} onChange={e => setFGrad(e.target.value)} className="mt-1 block rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5">
            <option value="">Todas</option>{graduacoes.map(g => <option key={g}>{g}</option>)}
          </select>
        </label>
        <label className="text-sm">Medalha VM
          <select value={fMedalha} onChange={e => setFMedalha(e.target.value)} className="mt-1 block rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5">
            <option value="">Todas</option>
            <option value="pendente">Pendentes de recebimento</option>
            <option value="em-dia">Recebida</option>
            <option value="nao-faz-jus">Ainda não faz jus</option>
            <option value="sem-data">Ingresso na PM não informado</option>
            <option value="verificar">Verificar</option>
          </select>
        </label>
        <label className="text-sm">Faz jus a
          <select value={fFazJus} onChange={e => setFFazJus(e.target.value)} className="mt-1 block rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5">
            <option value="">Todos</option><option value="bronze">Bronze</option><option value="prata">Prata</option><option value="ouro">Ouro</option>
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
            <button onClick={() => setEditando("novo")} className="rounded bg-[#1f3a5f] dark:bg-[#2e5283] px-4 py-1.5 text-sm text-white">Adicionar integrante</button>
          </>
        )}
      </div>

      {erro && <p role="alert" className="rounded border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-400">{erro}</p>}

      {editando && (
        <FormMembro key={editando === "novo" ? "novo" : editando.id} editando={editando} pending={pending} salvar={salvar} onCancelar={() => setEditando(null)} />
      )}

      <p className="text-sm text-slate-600 dark:text-slate-400">
        {lista.length} integrante(s) · Medalha VM: {resumoMedalha.pendentes} pendente(s) · {resumoMedalha.recebidas} recebida(s) · {resumoMedalha.semData} sem data de ingresso
      </p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <table className="mobile-cards w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-left text-slate-600 dark:text-slate-400">
            <tr><th className="px-3 py-2">Graduação</th><th className="px-3 py-2">RE</th><th className="px-3 py-2">Nome</th><th className="px-3 py-2">CNH</th><th className="px-3 py-2">SAT</th><th className="px-3 py-2">Elogios</th><th className="px-3 py-2">Láurea</th><th className="px-3 py-2">Medalha VM</th><th className="px-3 py-2">Ingresso equipe</th><th className="px-3 py-2">Situação</th>{podeGerenciar && <th className="px-3 py-2">Ações</th>}</tr>
          </thead>
          <tbody>
            {lista.map(i => (
              <tr key={i.id} onClick={() => router.push(`/efetivo/${i.id}`)} className="cursor-pointer border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800">
                <td data-label="Graduação" className="px-3 py-2">{i.graduacao}</td>
                <td data-label="RE" className="px-3 py-2 font-mono">{i.re}</td>
                <td data-label="Nome" className="px-3 py-2">{i.nome}{i.nomeGuerra ? ` (${i.nomeGuerra})` : ""}</td>
                <td data-label="CNH" className="px-3 py-2">{i.complemento?.cnh || "—"}</td>
                <td data-label="SAT" className="px-3 py-2">{i.complemento?.sat || "—"}</td>
                <td data-label="Elogios" className="px-3 py-2">{i.totalElogiosPublicados === null ? <span className="text-xs text-slate-400 dark:text-slate-500">sem registro</span> : i.totalElogiosPublicados}</td>
                <td data-label="Láurea" className="px-3 py-2">{i.laureaVigente ? <>{i.laureaVigente.grau} <span className="text-xs text-slate-500 dark:text-slate-400">({formatBR(i.laureaVigente.data)})</span></> : <span className="text-xs text-slate-400 dark:text-slate-500">sem registro</span>}</td>
                <td data-label="Medalha VM" className="px-3 py-2">
                  {i.medalha.devida ? ROTULO_GRAU[i.medalha.devida] : "—"} <MedalhaBadge situacao={i.medalha.situacao} />
                </td>
                <td data-label="Ingresso equipe" className="px-3 py-2">{formatBR(i.complemento?.ingressoEquipe)}{!i.complemento?.ingressoEquipe && <span className="text-xs text-amber-700 dark:text-amber-400"> pendente</span>}</td>
                <td data-label="Situação" className="px-3 py-2">{i.complemento?.situacaoEquipe ?? i.situacao ?? "ativo"}</td>
                {podeGerenciar && (
                  <td data-label="Ações" className="px-3 py-2 space-x-2" onClick={e => e.stopPropagation()}>
                    {i.complemento?.situacaoEquipe !== "excluido" && <>
                      <button onClick={() => setEditando(i)} className="text-xs text-[#1f3a5f] dark:text-[#8fb3e6] underline">Editar</button>
                      <button onClick={() => setExcluindo(i)} className="text-xs text-red-700 dark:text-red-400 underline">Excluir</button>
                    </>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmarExclusao
        aberto={excluindo !== null}
        titulo={`Excluir ${excluindo?.nome ?? ""}?`}
        onConfirmar={excluir}
        onCancelar={() => setExcluindo(null)}
        pending={pending}
      />
    </div>
  );
}

function FormMembro({ editando, pending, salvar, onCancelar }: { editando: Item | "novo"; pending: boolean; salvar: (fd: FormData) => void; onCancelar: () => void }) {
  const [ingressoPM, setIngressoPM] = useState(editando === "novo" ? "" : editando.ingressoPM ?? "");
  const dica = useMemo(() => {
    if (!ingressoPM) return "Informe o ingresso na PM";
    const m = calcularMedalha(ingressoPM, undefined, undefined, hojeSP());
    if (!m.tempo) return "Informe o ingresso na PM";
    return m.devida ? `Faz jus: ${ROTULO_GRAU[m.devida]} · ${m.tempo.anos} anos` : `Ainda não faz jus · ${m.tempo.anos} anos`;
  }, [ingressoPM]);
  const comp = editando === "novo" ? null : editando.complemento;

  return (
    <form action={salvar} className="grid gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 md:grid-cols-3">
      <h2 className="font-semibold text-[#1f3a5f] dark:text-[#8fb3e6] md:col-span-3">{editando === "novo" ? "Novo integrante" : `Editar ${editando.nome}`}</h2>
      <label className="text-sm">Graduação
        <select name="graduacao" required defaultValue={editando === "novo" ? "CB PM" : editando.graduacao} className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5">
          {GRADUACOES.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </label>
      <label className="text-sm">RE
        <input name="re" required defaultValue={editando === "novo" ? "" : editando.re} className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5 font-mono" />
      </label>
      <label className="text-sm">Nome
        <input name="nome" required defaultValue={editando === "novo" ? "" : editando.nome} className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5" />
      </label>
      <label className="text-sm">Nome de guerra
        <input name="nomeGuerra" defaultValue={editando === "novo" ? "" : editando.nomeGuerra ?? ""} className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5" />
      </label>
      <label className="text-sm">Ingresso na PM
        <input name="ingressoPM" type="date" value={ingressoPM} onChange={e => setIngressoPM(e.target.value)} className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5" />
      </label>
      <label className="text-sm">Ingresso na equipe
        <input name="ingressoEquipe" type="date" defaultValue={comp?.ingressoEquipe ?? ""} className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5" />
      </label>
      <label className="text-sm">CNH
        <input name="cnh" placeholder="AB" defaultValue={comp?.cnh ?? ""} className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5 uppercase" />
      </label>
      <label className="text-sm">SAT
        <input name="sat" placeholder="AB" defaultValue={comp?.sat ?? ""} className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5 uppercase" />
      </label>
      <label className="text-sm">Medalha recebida
        <select name="medalhaRecebida" defaultValue={comp?.medalhaRecebida ?? ""} className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5">
          <option value="">Nenhuma</option><option value="bronze">Bronze</option><option value="prata">Prata</option><option value="ouro">Ouro</option>
        </select>
      </label>
      <label className="text-sm">Data do recebimento
        <input name="medalhaRecebidaEm" type="date" defaultValue={comp?.medalhaRecebidaEm ?? ""} className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5" />
      </label>
      <p className="self-end text-xs text-slate-600 dark:text-slate-400">Medalha VM: {dica}</p>
      {editando !== "novo" && (
        <label className="text-sm">Situação na equipe
          <select name="situacaoEquipe" defaultValue={editando.complemento?.situacaoEquipe ?? "ativo"} className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5">
            <option value="ativo">Ativo</option><option value="afastado">Afastado</option><option value="transferido">Transferido</option><option value="reserva">Reserva</option>
          </select>
        </label>
      )}
      <div className="flex items-end gap-2 md:col-span-3">
        <button disabled={pending} className="rounded bg-[#1f3a5f] dark:bg-[#2e5283] px-4 py-1.5 text-sm text-white disabled:opacity-60">{pending ? "Salvando…" : "Salvar"}</button>
        <button type="button" onClick={onCancelar} className="rounded border border-slate-300 dark:border-slate-600 px-4 py-1.5 text-sm">Cancelar</button>
      </div>
    </form>
  );
}
