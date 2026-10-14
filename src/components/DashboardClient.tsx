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
  const evolucao = dados.evolucao;
  const maxBruto = Math.max(0, ...evolucao.map(e => Math.max(e.elogios, e.laureas)));
  const passo = Math.max(1, Math.ceil(maxBruto / 4));
  const yMax = Math.max(4, passo * 4);
  const ticks = [0, 1, 2, 3, 4].map(i => i * (yMax / 4));
  // Geometria do gráfico (viewBox 600x220)
  const ML = 36, MR = 8, MT = 18, MB = 26;
  const W = 600, H = 220, PW = W - ML - MR, PH = H - MT - MB;
  const slotW = evolucao.length ? PW / evolucao.length : PW;
  const barW = Math.min(28, Math.max(4, slotW / 2 - 3));
  const rotuloACada = evolucao.length > 8 ? 2 : 1;
  const vazio = evolucao.every(e => e.elogios === 0 && e.laureas === 0);
  const yOf = (v: number) => MT + PH - (v / yMax) * PH;

  const criterioLabel = { solicitacao: "Data da solicitação", publicacao: "Data de publicação", concessao: "Data da concessão" }[filtro.criterio];

  return (
    <div className="flex flex-col gap-6">
      <div className="print-only">
        <h1 className="text-xl font-semibold">Controle de Láureas — Equipe B · Dashboard</h1>
        <p className="text-sm" suppressHydrationWarning>Período: {formatBR(dados.de)} a {formatBR(dados.ate)} · Critério: {criterioLabel} · Gerado em {new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
      </div>
      <div className="no-print flex flex-col items-stretch gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-end">
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

      <div className="print-kpis grid grid-cols-2 gap-3 md:grid-cols-6">
        {[
          ["Efetivo ativo", dados.efetivoAtivo, "total atual"],
          ["Elogios solicitados", dados.elogiosSolicitados, "no período"],
          ["Elogios publicados", dados.elogiosPublicados, "no período"],
          ["Láureas concedidas", dados.laureasPeriodo, "no período"],
          ["Pendentes", dados.pendentes, "aguardando publicação"],
          ["Negados", dados.elogiosNegados, "no período"],
        ].map(([t, v, s]) => (
          <div key={t as string} className="print-card rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">{t}</p>
            <p className="text-3xl font-semibold text-[#1f3a5f]">{v}</p>
            <p className="text-xs text-slate-500">{s}</p>
          </div>
        ))}
      </div>

      <div className="print-grid grid gap-4 md:grid-cols-2">
        <section className="break-inside-avoid rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-[#1f3a5f]">Elogios × Sargento</h2>
          {dados.participacao.length === 0 ? <p className="text-sm text-slate-500">Nenhum registro no período.</p> : (
            <table className="mobile-cards w-full text-sm">
              <thead><tr className="text-left text-slate-600"><th className="pb-2">Solicitante</th><th className="pb-2">Solicitações</th><th className="pb-2">Publicações</th><th className="pb-2">Pendências</th><th className="pb-2">Negados</th></tr></thead>
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
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Evolução mensal de elogios e láureas">
            {ticks.map(t => (
              <g key={t}>
                <line x1={ML} y1={yOf(t)} x2={W - MR} y2={yOf(t)} stroke="#e2e8f0" strokeWidth={1} />
                <text x={ML - 5} y={yOf(t) + 3} textAnchor="end" fontSize={9} fill="#64748b">{t}</text>
              </g>
            ))}
            <line x1={ML} y1={MT + PH} x2={W - MR} y2={MT + PH} stroke="#94a3b8" strokeWidth={1} />
            {evolucao.map((e, idx) => {
              const cx = ML + slotW * idx + slotW / 2;
              return (
                <g key={e.mes}>
                  {e.elogios > 0 && (
                    <text x={cx - barW / 2 - 1} y={yOf(e.elogios) - 3} textAnchor="middle" fontSize={10} fill="#1f3a5f">{e.elogios}</text>
                  )}
                  {e.laureas > 0 && (
                    <text x={cx + barW / 2 + 1} y={yOf(e.laureas) - 3} textAnchor="middle" fontSize={10} fill="#92690f">{e.laureas}</text>
                  )}
                  <rect className="bar-elogios" x={cx - barW - 1} y={yOf(e.elogios)} width={barW} height={Math.max(0, MT + PH - yOf(e.elogios))} fill="#1f3a5f">
                    <title>{`Elogios: ${e.elogios}`}</title>
                  </rect>
                  <rect className="bar-laureas" x={cx + 1} y={yOf(e.laureas)} width={barW} height={Math.max(0, MT + PH - yOf(e.laureas))} fill="#c9a227">
                    <title>{`Láureas: ${e.laureas}`}</title>
                  </rect>
                  {idx % rotuloACada === 0 && (
                    <text x={cx} y={H - 8} textAnchor="middle" fontSize={9} fill="#64748b">{e.mes.slice(5)}/{e.mes.slice(2, 4)}</text>
                  )}
                </g>
              );
            })}
            {vazio && (
              <text x={W / 2} y={MT + PH / 2} textAnchor="middle" fontSize={11} fill="#94a3b8">Nenhum registro no período.</text>
            )}
          </svg>
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
