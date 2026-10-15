"use client";
import { useState } from "react";

export function RelatoriosClient() {
  const [tipo, setTipo] = useState("efetivo");
  const [periodo, setPeriodo] = useState("mes-atual");
  const [criterio, setCriterio] = useState("solicitacao");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  const url = `/api/relatorios?tipo=${tipo}&periodo=${periodo}&criterio=${criterio}${de ? `&de=${de}` : ""}${ate ? `&ate=${ate}` : ""}`;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-[#1f3a5f] dark:text-[#8fb3e6]">Relatórios (Excel .xlsx)</h1>
      <div className="flex flex-col items-stretch gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="text-sm">Relatório
          <select value={tipo} onChange={e => setTipo(e.target.value)} className="mt-1 block rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5">
            <option value="efetivo">Efetivo</option>
            <option value="elogios">Elogios</option>
            <option value="laureas">Láureas</option>
            <option value="participacao">Participação por sargento</option>
          </select>
        </label>
        {tipo !== "efetivo" && <>
          <label className="text-sm">Período
            <select value={periodo} onChange={e => setPeriodo(e.target.value)} className="mt-1 block rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5">
              <option value="mes-atual">Mês atual</option><option value="ultimos-6">Últimos 6 meses</option>
              <option value="ultimos-12">Últimos 12 meses</option><option value="personalizado">Personalizado</option>
            </select>
          </label>
          <label className="text-sm">Data usada
            <select value={criterio} onChange={e => setCriterio(e.target.value)} className="mt-1 block rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5">
              <option value="solicitacao">Data da solicitação</option><option value="publicacao">Data de publicação</option>
            </select>
          </label>
          {periodo === "personalizado" && <>
            <label className="text-sm">De <input type="date" value={de} onChange={e => setDe(e.target.value)} className="mt-1 block rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5" /></label>
            <label className="text-sm">Até <input type="date" value={ate} onChange={e => setAte(e.target.value)} className="mt-1 block rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5" /></label>
          </>}
        </>}
        <a href={url} className="rounded bg-[#1f3a5f] dark:bg-[#2e5283] px-4 py-2 text-sm text-white">Baixar Excel</a>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">O arquivo inclui todos os registros autorizados que atendem aos filtros, com filtros e momento de geração registrados na primeira linha.</p>
    </div>
  );
}
