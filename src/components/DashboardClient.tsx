"use client";
import { useRouter } from "next/navigation";
import { formatBR } from "@/lib/dates";
import type { FiltroPeriodo } from "@/lib/types";

type Dados = Awaited<ReturnType<typeof import("@/server/actions").obterDashboard>>;

export function DashboardClient({ dados, filtro }: { dados: Dados; filtro: FiltroPeriodo }) {
  const router = useRouter();
  function setParam(k: string, v: string) {
    const p = new URLSearchParams({ periodo: filtro.tipo, criterio: filtro.criterio, ...(filtro.de ? { de: filtro.de } : {}), ...(filtro.ate ? { ate: filtro.ate } : {}) });
    p.set(k, v);
    router.push(`/?${p.toString()}`);
  }
  const maxEvol = Math.max(1, ...dados.evolucao.map(e => e.elogios + e.laureas));

  const criterioLabel = { solicitacao: "Data da solicitação", publicacao: "Data de publicação", concessao: "Data da concessão" }[filtro.criterio];

  return (
    <div className="flex flex-col gap-6">
      <div className="print-only">
        <h1 className="text-xl font-semibold">Controle de Láureas — Equipe B · Dashboard</h1>
        <p className="text-sm">Período: {formatBR(dados.de)} a {formatBR(dados.ate)} · Critério: {criterioLabel} · Gerado em {new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
      </div>
      <div className="no-print flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="text-sm">Período
          <select value={filtro.tipo} onChange={e => setParam("periodo", e.target.value)} className="mt-1 block rounded border border-slate-300 px-2 py-1.5">
            <option value="mes-atual">Mês atual</option>
            <option value="ultimos-6">Últimos 6 meses</option>
            <option value="ultimos-12">Últimos 12 meses</option>
            <option value="personalizado">Personalizado</option>
          </select>
        </label>
        <label className="text-sm">Data usada
          <select value={filtro.criterio} onChange={e => setParam("criterio", e.target.value)} className="mt-1 block rounded border border-slate-300 px-2 py-1.5">
            <option value="solicitacao">Data da solicitação</option>
            <option value="publicacao">Data de publicação</option>
            <option value="concessao">Data da concessão</option>
          </select>
        </label>
        {filtro.tipo === "personalizado" && (
          <>
            <label className="text-sm">De <input type="date" defaultValue={filtro.de} onChange={e => setParam("de", e.target.value)} className="mt-1 block rounded border border-slate-300 px-2 py-1.5" /></label>
            <label className="text-sm">Até <input type="date" defaultValue={filtro.ate} onChange={e => setParam("ate", e.target.value)} className="mt-1 block rounded border border-slate-300 px-2 py-1.5" /></label>
          </>
        )}
        <span className="text-xs text-slate-500">Período aplicado: {formatBR(dados.de)} a {formatBR(dados.ate)}</span>
        <button onClick={() => window.print()} className="rounded border border-[#1f3a5f] px-4 py-1.5 text-sm text-[#1f3a5f]">Exportar PDF</button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {[
          ["Efetivo ativo", dados.efetivoAtivo, "total atual"],
          ["Elogios solicitados", dados.elogiosSolicitados, "no período"],
          ["Elogios publicados", dados.elogiosPublicados, "no período"],
          ["Láureas concedidas", dados.laureasPeriodo, "no período"],
          ["Pendentes", dados.pendentes, "aguardando publicação"],
          ["Negados", dados.elogiosNegados, "no período"],
        ].map(([t, v, s]) => (
          <div key={t as string} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">{t}</p>
            <p className="text-3xl font-semibold text-[#1f3a5f]">{v}</p>
            <p className="text-xs text-slate-500">{s}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="break-inside-avoid rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-[#1f3a5f]">Elogios × Sargento</h2>
          {dados.participacao.length === 0 ? <p className="text-sm text-slate-500">Nenhum registro no período.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-slate-600"><th className="pb-2">Sargento</th><th className="pb-2">Solicitações</th><th className="pb-2">Publicações</th><th className="pb-2">Pendências</th><th className="pb-2">Negados</th></tr></thead>
              <tbody>
                {dados.participacao.map(p => (
                  <tr key={p.sargento} className="border-t border-slate-100">
                    <td className="py-1.5">{p.sargento}</td><td>{p.solicitacoes}</td><td>{p.publicacoes}</td><td>{p.pendencias}</td><td>{p.negados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="break-inside-avoid rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-[#1f3a5f]">Evolução mensal</h2>
          {dados.evolucao.length === 0 ? <p className="text-sm text-slate-500">Nenhum registro no período.</p> : (
            <div className="flex items-end gap-2">
              {dados.evolucao.map(e => (
                <div key={e.mes} className="flex flex-1 flex-col items-center gap-1">
                  <div className="w-full rounded-t bg-[#1f3a5f]" style={{ height: `${(e.elogios / maxEvol) * 80}px` }} title={`Elogios: ${e.elogios}`} />
                  <div className="w-full rounded-t bg-[#c9a227]" style={{ height: `${(e.laureas / maxEvol) * 80}px` }} title={`Láureas: ${e.laureas}`} />
                  <span className="text-[10px] text-slate-500">{e.mes.slice(5)}/{e.mes.slice(2, 4)}</span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-slate-500"><span className="text-[#1f3a5f]">■</span> elogios &nbsp;<span className="text-[#c9a227]">■</span> láureas</p>
        </section>

        <section className="break-inside-avoid rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-[#1f3a5f]">Distribuição por grau de láurea</h2>
          <ul className="text-sm">
            {Object.entries(dados.distribuicao).map(([g, n]) => <li key={g}>{g} grau: {n}</li>)}
            <li className="mt-2 text-slate-600">Sem concessão registrada: {dados.semLaurea} <span className="text-xs">(pode incluir histórico ainda não informado)</span></li>
          </ul>
        </section>

        <section className="break-inside-avoid rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-[#1f3a5f]">Últimas movimentações</h2>
          {dados.ultimos.length === 0 ? <p className="text-sm text-slate-500">Nenhuma movimentação.</p> : (
            <ul className="text-sm">
              {dados.ultimos.map(u => (
                <li key={u.id} className="border-t border-slate-100 py-1.5">
                  <a href="/elogios" className="text-[#1f3a5f] hover:underline">{u.titulo}</a>
                  <span className="text-slate-500"> — {u.situacao}, {formatBR(u.data ?? undefined)} — {u.destinatarios.join(", ")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
