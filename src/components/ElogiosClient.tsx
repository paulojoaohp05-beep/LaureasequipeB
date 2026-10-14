"use client";
import { useMemo, useState, useTransition } from "react";
import { criarElogio, publicarElogio, cancelarElogio } from "@/server/actions";
import { formatBR } from "@/lib/dates";
import type { Elogio, Integrante } from "@/lib/types";

export function ElogiosClient({ elogios, integrantes }: { elogios: Elogio[]; integrantes: Integrante[] }) {
  const [aberto, setAberto] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [erro, setErro] = useState("");
  const [pending, start] = useTransition();
  const nomes = useMemo(() => new Map(integrantes.map(i => [i.id, i.nomeGuerra || i.nome])), [integrantes]);

  const lista = elogios.filter(e => !filtro || e.situacao === filtro);

  function enviar(fd: FormData) {
    setErro("");
    start(async () => {
      try {
        await criarElogio({
          titulo: String(fd.get("titulo") ?? ""), descricao: String(fd.get("descricao") ?? ""),
          destinatarioIds: fd.getAll("destinatarios") as string[],
          solicitanteId: String(fd.get("solicitante") ?? ""),
          dataSolicitacao: String(fd.get("dataSolicitacao") ?? ""),
        });
        setAberto(false);
      } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao registrar"); }
    });
  }

  function publicar(id: string) {
    const dataPublicacao = prompt("Data de publicação (AAAA-MM-DD):") ?? "";
    const referencia = prompt("Referência do boletim/documento:") ?? "";
    if (!dataPublicacao || !referencia) return;
    start(async () => { try { await publicarElogio(id, { dataPublicacao, referencia }); } catch (e) { setErro(e instanceof Error ? e.message : "Erro"); } });
  }
  function cancelar(id: string) {
    const j = prompt("Justificativa do cancelamento:") ?? "";
    if (!j.trim()) return;
    start(async () => { try { await cancelarElogio(id, j); } catch (e) { setErro(e instanceof Error ? e.message : "Erro"); } });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-[#1f3a5f]">Elogios</h1>
        <div className="flex gap-2">
          <select value={filtro} onChange={e => setFiltro(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Todas as situações</option><option value="solicitado">Solicitados</option><option value="publicado">Publicados</option><option value="cancelado">Cancelados</option>
          </select>
          <button onClick={() => setAberto(!aberto)} className="rounded bg-[#1f3a5f] px-4 py-1.5 text-sm text-white">Nova solicitação</button>
        </div>
      </div>
      {erro && <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {aberto && (
        <form action={enviar} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-2">
          <label className="text-sm md:col-span-2">Título
            <input name="titulo" required className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5" />
          </label>
          <label className="text-sm md:col-span-2">Descrição/motivo
            <textarea name="descricao" rows={3} className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5" />
          </label>
          <label className="text-sm">Destinatário(s)
            <select name="destinatarios" multiple required size={5} className="mt-1 w-full rounded border border-slate-300 px-2 py-1">
              {integrantes.map(i => <option key={i.id} value={i.id}>{i.graduacao} {i.nomeGuerra || i.nome}</option>)}
            </select>
          </label>
          <div className="flex flex-col gap-3">
            <label className="text-sm">Sargento solicitante
              <select name="solicitante" required className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5">
                <option value="">Selecione…</option>
                {integrantes.map(i => <option key={i.id} value={i.id}>{i.graduacao} {i.nomeGuerra || i.nome}</option>)}
              </select>
            </label>
            <label className="text-sm">Data da solicitação
              <input name="dataSolicitacao" type="date" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" />
            </label>
            <button disabled={pending} className="mt-2 rounded bg-[#1f3a5f] px-4 py-2 text-white disabled:opacity-60">{pending ? "Salvando…" : "Registrar solicitação"}</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr><th className="px-3 py-2">Título</th><th className="px-3 py-2">Destinatário(s)</th><th className="px-3 py-2">Solicitante</th><th className="px-3 py-2">Solicitação</th><th className="px-3 py-2">Situação</th><th className="px-3 py-2">Publicação</th><th className="px-3 py-2">Ações</th></tr>
          </thead>
          <tbody>
            {lista.map(e => (
              <tr key={e.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{e.titulo}</td>
                <td className="px-3 py-2">{e.destinatarioIds.map(d => nomes.get(d) ?? d).join(", ")}</td>
                <td className="px-3 py-2">{nomes.get(e.solicitanteId) ?? e.solicitanteId}</td>
                <td className="px-3 py-2">{formatBR(e.dataSolicitacao)}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${e.situacao === "publicado" ? "bg-green-100 text-green-800" : e.situacao === "solicitado" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{e.situacao}</span>
                </td>
                <td className="px-3 py-2">{formatBR(e.dataPublicacao)}{e.referencia ? ` · ${e.referencia}` : ""}</td>
                <td className="px-3 py-2 space-x-2">
                  {e.situacao === "solicitado" && <>
                    <button onClick={() => publicar(e.id)} className="text-xs text-green-700 underline">Publicar</button>
                    <button onClick={() => cancelar(e.id)} className="text-xs text-red-700 underline">Cancelar</button>
                  </>}
                </td>
              </tr>
            ))}
            {lista.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">Nenhum registro.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
