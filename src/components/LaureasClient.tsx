"use client";
import { useMemo, useState, useTransition } from "react";
import { registrarLaurea } from "@/server/actions";
import { IntegrantePicker } from "./IntegrantePicker";
import { formatBR } from "@/lib/dates";
import type { Integrante, Laurea } from "@/lib/types";

export function LaureasClient({ laureas, integrantes }: { laureas: Laurea[]; integrantes: Integrante[] }) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState("");
  const [pending, start] = useTransition();
  const nomes = useMemo(() => new Map(integrantes.map(i => [i.id, i.nomeGuerra || i.nome])), [integrantes]);
  const ordenadas = [...laureas].sort((a, b) => b.dataConcessao.localeCompare(a.dataConcessao));

  function enviar(fd: FormData) {
    setErro("");
    start(async () => {
      try {
        await registrarLaurea({
          integranteId: String(fd.get("integrante") ?? ""), grau: String(fd.get("grau") ?? ""),
          dataConcessao: String(fd.get("dataConcessao") ?? ""), dataPublicacao: String(fd.get("dataPublicacao") ?? "") || undefined,
          referencia: String(fd.get("referencia") ?? "") || undefined, solicitanteId: String(fd.get("solicitante") ?? "") || undefined,
          observacao: String(fd.get("observacao") ?? "") || undefined,
        });
        setAberto(false);
      } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao registrar"); }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold text-[#1f3a5f]">Láureas</h1>
        <button onClick={() => setAberto(!aberto)} className="rounded bg-[#1f3a5f] px-4 py-1.5 text-sm text-white">Registrar concessão</button>
      </div>
      {erro && <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {aberto && (
        <form action={enviar} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-3">
          <label className="text-sm">Integrante
            <div className="mt-1"><IntegrantePicker name="integrante" integrantes={integrantes} required placeholder="Digite nome ou RE…" /></div>
          </label>
          <label className="text-sm">Grau
            <select name="grau" required className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5">
              {["1º", "2º", "3º", "4º", "5º"].map(g => <option key={g}>{g}</option>)}
            </select>
          </label>
          <label className="text-sm">Data da concessão
            <input name="dataConcessao" type="date" required className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" />
          </label>
          <label className="text-sm">Data de publicação
            <input name="dataPublicacao" type="date" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" />
          </label>
          <label className="text-sm">Referência
            <input name="referencia" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" />
          </label>
          <label className="text-sm">Solicitante (se conhecido)
            <div className="mt-1"><IntegrantePicker name="solicitante" integrantes={integrantes} placeholder="Digite nome ou RE…" /></div>
          </label>
          <label className="text-sm md:col-span-3">Observação
            <input name="observacao" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" />
          </label>
          <button disabled={pending} className="rounded bg-[#1f3a5f] px-4 py-2 text-white disabled:opacity-60 md:col-span-3">{pending ? "Salvando…" : "Registrar"}</button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="mobile-cards w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr><th className="px-3 py-2">Integrante</th><th className="px-3 py-2">Grau</th><th className="px-3 py-2">Concessão</th><th className="px-3 py-2">Publicação</th><th className="px-3 py-2">Referência</th><th className="px-3 py-2">Observação</th></tr>
          </thead>
          <tbody>
            {ordenadas.map(l => (
              <tr key={l.id} className="border-t border-slate-100">
                <td data-label="Integrante" className="px-3 py-2">{nomes.get(l.integranteId) ?? l.integranteId}</td>
                <td data-label="Grau" className="px-3 py-2">{l.grau}</td>
                <td data-label="Concessão" className="px-3 py-2">{formatBR(l.dataConcessao)}</td>
                <td data-label="Publicação" className="px-3 py-2">{formatBR(l.dataPublicacao)}</td>
                <td data-label="Referência" className="px-3 py-2">{l.referencia || "—"}</td>
                <td data-label="Observação" className="px-3 py-2">{l.observacao || "—"}</td>
              </tr>
            ))}
            {ordenadas.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Nenhuma láurea registrada.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
