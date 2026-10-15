"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registrarLaurea, editarLaurea, excluirLaurea } from "@/server/actions";
import { IntegrantePicker } from "./IntegrantePicker";
import { ConfirmarExclusao } from "./ConfirmarExclusao";
import { formatBR } from "@/lib/dates";
import type { Integrante, Laurea, Perfil } from "@/lib/types";

export function LaureasClient({ laureas, integrantes, perfil }: { laureas: Laurea[]; integrantes: Integrante[]; perfil: Perfil }) {
  const [form, setForm] = useState<null | "novo" | Laurea>(null);
  const [excluindo, setExcluindo] = useState<Laurea | null>(null);
  const [erro, setErro] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const nomes = useMemo(() => new Map(integrantes.map(i => [i.id, i.nomeGuerra || i.nome])), [integrantes]);
  const podeGerenciar = perfil === "admin" || perfil === "gestor";
  const ordenadas = [...laureas].sort((a, b) => b.dataConcessao.localeCompare(a.dataConcessao));

  const editando = form !== null && form !== "novo" ? form : null;

  function excluir() {
    if (!excluindo) return;
    start(async () => {
      try { await excluirLaurea(excluindo.id); setExcluindo(null); router.refresh(); }
      catch (e) { setErro(e instanceof Error ? e.message : "Erro"); }
    });
  }

  function enviar(fd: FormData) {
    setErro("");
    const campos = {
      integranteId: String(fd.get("integrante") ?? ""), grau: String(fd.get("grau") ?? ""),
      dataConcessao: String(fd.get("dataConcessao") ?? ""), dataPublicacao: String(fd.get("dataPublicacao") ?? "") || undefined,
      referencia: String(fd.get("referencia") ?? "") || undefined, solicitanteId: String(fd.get("solicitante") ?? "") || undefined,
      observacao: String(fd.get("observacao") ?? "") || undefined,
    };
    start(async () => {
      try {
        if (editando) await editarLaurea(editando.id, campos);
        else await registrarLaurea(campos);
        setForm(null);
        router.refresh();
      } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao registrar"); }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold text-[#1f3a5f] dark:text-[#8fb3e6]">Láureas</h1>
        <button onClick={() => setForm(form ? null : "novo")} className="rounded bg-[#1f3a5f] dark:bg-[#2e5283] px-4 py-1.5 text-sm text-white">Registrar concessão</button>
      </div>
      {erro && <p role="alert" className="rounded border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-400">{erro}</p>}

      {form && (
        <form key={editando?.id ?? "novo"} action={enviar} className="grid gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 md:grid-cols-3">
          <h2 className="font-semibold text-[#1f3a5f] dark:text-[#8fb3e6] md:col-span-3">{editando ? `Editar láurea — ${nomes.get(editando.integranteId) ?? editando.integranteId}` : "Nova concessão"}</h2>
          <label className="text-sm">Integrante
            <div className="mt-1"><IntegrantePicker name="integrante" integrantes={integrantes} required inicial={editando ? [editando.integranteId] : undefined} placeholder="Digite nome ou RE…" /></div>
          </label>
          <label className="text-sm">Grau
            <select name="grau" required defaultValue={editando?.grau ?? "1º"} className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5">
              {["1º", "2º", "3º", "4º", "5º"].map(g => <option key={g}>{g}</option>)}
            </select>
          </label>
          <label className="text-sm">Data da concessão
            <input name="dataConcessao" type="date" required defaultValue={editando?.dataConcessao ?? ""} className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5" />
          </label>
          <label className="text-sm">Data de publicação
            <input name="dataPublicacao" type="date" defaultValue={editando?.dataPublicacao ?? ""} className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5" />
          </label>
          <label className="text-sm">Boletim Interno Nº
            <input name="referencia" defaultValue={editando?.referencia ?? ""} className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5" />
          </label>
          <label className="text-sm">Solicitante (se conhecido)
            <div className="mt-1"><IntegrantePicker name="solicitante" integrantes={integrantes} inicial={editando?.solicitanteId ? [editando.solicitanteId] : undefined} placeholder="Digite nome ou RE…" /></div>
          </label>
          <label className="text-sm md:col-span-3">Observação
            <input name="observacao" defaultValue={editando?.observacao ?? ""} className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5" />
          </label>
          <div className="flex items-end gap-2 md:col-span-3">
            <button disabled={pending} className="rounded bg-[#1f3a5f] dark:bg-[#2e5283] px-4 py-2 text-white disabled:opacity-60">{pending ? "Salvando…" : editando ? "Salvar alterações" : "Registrar"}</button>
            <button type="button" onClick={() => setForm(null)} className="rounded border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm">Cancelar</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <table className="mobile-cards w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-left text-slate-600 dark:text-slate-400">
            <tr><th className="px-3 py-2">Integrante</th><th className="px-3 py-2">Grau</th><th className="px-3 py-2">Concessão</th><th className="px-3 py-2">Publicação</th><th className="px-3 py-2">Boletim Interno Nº</th><th className="px-3 py-2">Observação</th>{podeGerenciar && <th className="px-3 py-2">Ações</th>}</tr>
          </thead>
          <tbody>
            {ordenadas.map(l => (
              <tr key={l.id} className="border-t border-slate-100 dark:border-slate-800">
                <td data-label="Integrante" className="px-3 py-2">{nomes.get(l.integranteId) ?? l.integranteId}</td>
                <td data-label="Grau" className="px-3 py-2">{l.grau}</td>
                <td data-label="Concessão" className="px-3 py-2">{formatBR(l.dataConcessao)}</td>
                <td data-label="Publicação" className="px-3 py-2">{formatBR(l.dataPublicacao)}</td>
                <td data-label="Boletim Interno Nº" className="px-3 py-2">{l.referencia || "—"}</td>
                <td data-label="Observação" className="px-3 py-2">{l.observacao || "—"}</td>
                {podeGerenciar && (
                  <td data-label="Ações" className="px-3 py-2 space-x-2">
                    <button onClick={() => setForm(l)} className="text-xs text-[#1f3a5f] dark:text-[#8fb3e6] underline">Editar</button>
                    <button onClick={() => setExcluindo(l)} className="text-xs text-red-700 dark:text-red-400 underline">Excluir</button>
                  </td>
                )}
              </tr>
            ))}
            {ordenadas.length === 0 && <tr><td colSpan={podeGerenciar ? 7 : 6} className="px-3 py-6 text-center text-slate-500 dark:text-slate-400">Nenhuma láurea registrada.</td></tr>}
          </tbody>
        </table>
      </div>

      <ConfirmarExclusao
        aberto={excluindo !== null}
        titulo={excluindo ? `Excluir láurea ${excluindo.grau} de ${nomes.get(excluindo.integranteId) ?? excluindo.integranteId}?` : ""}
        onConfirmar={excluir}
        onCancelar={() => setExcluindo(null)}
        pending={pending}
      />
    </div>
  );
}
