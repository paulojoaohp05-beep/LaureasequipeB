"use client";
import { useMemo, useState, useTransition } from "react";
import { criarElogio, editarElogio, corrigirElogio, publicarElogio, negarElogio } from "@/server/actions";
import { IntegrantePicker } from "./IntegrantePicker";
import { formatBR } from "@/lib/dates";
import type { Elogio, Integrante, Perfil } from "@/lib/types";

type Form = { modo: "novo" } | { modo: "editar" | "corrigir"; e: Elogio };

export function ElogiosClient({ elogios, integrantes, perfil }: { elogios: Elogio[]; integrantes: Integrante[]; perfil: Perfil }) {
  const [form, setForm] = useState<Form | null>(null);
  const [jaPublicado, setJaPublicado] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [erro, setErro] = useState("");
  const [pending, start] = useTransition();
  const nomes = useMemo(() => new Map(integrantes.map(i => [i.id, i.nomeGuerra || i.nome])), [integrantes]);
  const podeGerenciar = perfil === "admin" || perfil === "gestor";
  // Servidor enforce a posse para editor; no cliente basta esconder do visualizador.
  const podeEditar = perfil !== "visualizador";

  const lista = elogios.filter(e => !filtro || e.situacao === filtro);

  function enviar(fd: FormData) {
    setErro("");
    const base = {
      titulo: String(fd.get("titulo") ?? ""), descricao: String(fd.get("descricao") ?? ""),
      dataSolicitacao: String(fd.get("dataSolicitacao") ?? ""),
      referencia: String(fd.get("referencia") ?? ""),
    };
    start(async () => {
      try {
        if (!form) return;
        if (form.modo === "novo") {
          await criarElogio({
            ...base,
            destinatarioIds: fd.getAll("destinatarios") as string[],
            solicitanteId: String(fd.get("solicitante") ?? ""),
            jaPublicado: fd.get("jaPublicado") === "on",
            dataPublicacao: String(fd.get("dataPublicacao") ?? ""),
          });
        } else if (form.modo === "editar") {
          await editarElogio(form.e.id, {
            ...base,
            destinatarioIds: fd.getAll("destinatarios") as string[],
            solicitanteId: String(fd.get("solicitante") ?? ""),
          });
        } else {
          await corrigirElogio(form.e.id, {
            ...base,
            dataPublicacao: String(fd.get("dataPublicacao") ?? "") || undefined,
            justificativaNegativa: String(fd.get("justificativaNegativa") ?? "") || undefined,
          });
        }
        setForm(null);
        setJaPublicado(false);
      } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao registrar"); }
    });
  }

  function publicar(id: string) {
    const dataPublicacao = prompt("Data de publicação (AAAA-MM-DD):") ?? "";
    const referencia = prompt("Boletim Interno Nº:") ?? "";
    if (!dataPublicacao || !referencia) return;
    start(async () => { try { await publicarElogio(id, { dataPublicacao, referencia }); } catch (e) { setErro(e instanceof Error ? e.message : "Erro"); } });
  }
  function negar(id: string) {
    const j = prompt("Justificativa da negativa:") ?? "";
    if (!j.trim()) return;
    start(async () => { try { await negarElogio(id, j); } catch (e) { setErro(e instanceof Error ? e.message : "Erro"); } });
  }

  const e = form && form.modo !== "novo" ? form.e : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-[#1f3a5f]">Elogios</h1>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <select value={filtro} onChange={e => setFiltro(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Todas as situações</option><option value="solicitado">Solicitados</option><option value="publicado">Publicados</option><option value="negado">Negados</option><option value="cancelado">Cancelados</option>
          </select>
          <button onClick={() => { setForm(form ? null : { modo: "novo" }); setJaPublicado(false); }} className="rounded bg-[#1f3a5f] px-4 py-1.5 text-sm text-white">Nova solicitação</button>
        </div>
      </div>
      {erro && <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {form && (
        <form key={e?.id ?? "novo"} action={enviar} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-2">
          <h2 className="font-semibold text-[#1f3a5f] md:col-span-2">
            {form.modo === "novo" ? "Nova solicitação" : form.modo === "editar" ? `Editar — ${e!.titulo}` : `Corrigir (${e!.situacao}) — ${e!.titulo}`}
          </h2>
          <label className="text-sm md:col-span-2">Título
            <input name="titulo" required defaultValue={e?.titulo ?? ""} className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5" />
          </label>
          <label className="text-sm md:col-span-2">Descrição/motivo
            <textarea name="descricao" rows={3} defaultValue={e?.descricao ?? ""} className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5" />
          </label>
          {form.modo !== "corrigir" && (
            <label className="text-sm">Destinatário(s)
              <div className="mt-1"><IntegrantePicker name="destinatarios" integrantes={integrantes} multi required inicial={e?.destinatarioIds} placeholder="Digite para adicionar…" /></div>
            </label>
          )}
          <div className="flex flex-col gap-3">
            {form.modo !== "corrigir" && (
              <label className="text-sm">Solicitante
                <div className="mt-1"><IntegrantePicker name="solicitante" integrantes={integrantes} required inicial={e ? [e.solicitanteId] : undefined} placeholder="Digite nome ou RE…" /></div>
              </label>
            )}
            <label className="text-sm">Data da solicitação
              <input name="dataSolicitacao" type="date" defaultValue={e?.dataSolicitacao ?? ""} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" />
            </label>
            <label className="text-sm">Boletim Interno Nº{form.modo === "novo" && !jaPublicado ? "" : " *"}
              <input name="referencia" required={form.modo === "corrigir" ? e?.situacao === "publicado" : jaPublicado} defaultValue={e?.referencia ?? ""} className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5" />
            </label>
            {form.modo === "corrigir" && (
              <>
                <label className="text-sm">Data de publicação
                  <input name="dataPublicacao" type="date" required={e?.situacao === "publicado"} defaultValue={e?.dataPublicacao ?? ""} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" />
                </label>
                {e?.situacao === "negado" && (
                  <label className="text-sm">Justificativa da negativa
                    <textarea name="justificativaNegativa" rows={2} defaultValue={e.justificativaNegativa ?? ""} className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5" />
                  </label>
                )}
              </>
            )}
            {form.modo === "novo" && podeGerenciar && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="jaPublicado" checked={jaPublicado} onChange={ev => setJaPublicado(ev.target.checked)} />
                Já publicado
              </label>
            )}
            {form.modo === "novo" && jaPublicado && (
              <label className="text-sm">Data de publicação
                <input name="dataPublicacao" type="date" required className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" />
              </label>
            )}
            <div className="flex items-end gap-2">
              <button disabled={pending} className="mt-2 rounded bg-[#1f3a5f] px-4 py-2 text-white disabled:opacity-60">
                {pending ? "Salvando…" : form.modo === "corrigir" ? "Salvar correção" : form.modo === "editar" ? "Salvar alterações" : jaPublicado ? "Registrar elogio" : "Registrar solicitação"}
              </button>
              <button type="button" onClick={() => { setForm(null); setJaPublicado(false); }} className="rounded border border-slate-300 px-4 py-2 text-sm">Cancelar</button>
            </div>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="mobile-cards w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr><th className="px-3 py-2">Título</th><th className="px-3 py-2">Destinatário(s)</th><th className="px-3 py-2">Solicitante</th><th className="px-3 py-2">Solicitação</th><th className="px-3 py-2">Situação</th><th className="px-3 py-2">Publicação</th><th className="px-3 py-2">Boletim Interno Nº</th><th className="px-3 py-2">Ações</th></tr>
          </thead>
          <tbody>
            {lista.map(e => (
              <tr key={e.id} className="border-t border-slate-100">
                <td data-label="Título" className="px-3 py-2">{e.titulo}</td>
                <td data-label="Destinatário(s)" className="px-3 py-2">{e.destinatarioIds.map(d => nomes.get(d) ?? d).join(", ")}</td>
                <td data-label="Solicitante" className="px-3 py-2">{nomes.get(e.solicitanteId) ?? e.solicitanteId}</td>
                <td data-label="Solicitação" className="px-3 py-2">{formatBR(e.dataSolicitacao)}</td>
                <td data-label="Situação" className="px-3 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${e.situacao === "publicado" ? "bg-green-100 text-green-800" : e.situacao === "solicitado" ? "bg-amber-100 text-amber-800" : e.situacao === "negado" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-600"}`}>{e.situacao}</span>
                </td>
                <td data-label="Publicação" className="px-3 py-2">
                  {e.situacao === "negado"
                    ? <span className="text-xs text-slate-600">{e.justificativaNegativa}</span>
                    : formatBR(e.dataPublicacao)}
                </td>
                <td data-label="Boletim Interno Nº" className="px-3 py-2">{e.referencia || "—"}</td>
                <td data-label="Ações" className="px-3 py-2 space-x-2">
                  {(e.situacao === "solicitado" || e.situacao === "rascunho") && podeEditar && (
                    <button onClick={() => { setForm({ modo: "editar", e }); setJaPublicado(false); }} className="text-xs text-[#1f3a5f] underline">Editar</button>
                  )}
                  {e.situacao === "solicitado" && podeGerenciar && <>
                    <button onClick={() => publicar(e.id)} className="text-xs text-green-700 underline">Publicar</button>
                    <button onClick={() => negar(e.id)} className="text-xs text-red-700 underline">Negar</button>
                  </>}
                  {(e.situacao === "publicado" || e.situacao === "negado") && podeGerenciar && (
                    <button onClick={() => { setForm({ modo: "corrigir", e }); setJaPublicado(false); }} className="text-xs text-[#1f3a5f] underline">Corrigir</button>
                  )}
                </td>
              </tr>
            ))}
            {lista.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">Nenhum registro.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
