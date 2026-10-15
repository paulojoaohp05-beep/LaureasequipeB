import { notFound, redirect } from "next/navigation";
import { obterFicha } from "@/server/actions";
import { formatBR, anosEntre, hojeSP } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function FichaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let f;
  try { f = await obterFicha(id); } catch { redirect("/login"); }
  if (!f) notFound();
  const { integrante: i, complemento, laureas, elogios } = f;
  const ingresso = complemento?.ingressoEquipe;

  return (
    <div className="flex flex-col gap-6">
      {complemento?.situacaoEquipe === "excluido" && (
        <p className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300">
          Integrante excluído do efetivo{complemento.excluidoEm ? ` em ${formatBR(complemento.excluidoEm.slice(0, 10))}` : ""}{complemento.motivoExclusao ? ` — ${complemento.motivoExclusao}` : ""}
        </p>
      )}
      <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
        <h1 className="text-xl font-semibold text-[#1f3a5f] dark:text-[#8fb3e6]">{i.nome}</h1>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
          <div><dt className="text-slate-500 dark:text-slate-400">Graduação</dt><dd>{i.graduacao}</dd></div>
          <div><dt className="text-slate-500 dark:text-slate-400">RE</dt><dd className="font-mono">{i.re}</dd></div>
          <div><dt className="text-slate-500 dark:text-slate-400">Nome de guerra</dt><dd>{i.nomeGuerra || "—"}</dd></div>
          <div><dt className="text-slate-500 dark:text-slate-400">Ingresso na PM</dt><dd>{formatBR(i.ingressoPM)}{!i.ingressoPM && <span className="text-xs text-amber-700 dark:text-amber-400"> pendente</span>}</dd></div>
          <div><dt className="text-slate-500 dark:text-slate-400">Ingresso na equipe</dt><dd>{formatBR(ingresso)}{!ingresso && <span className="text-xs text-amber-700 dark:text-amber-400"> pendente</span>}</dd></div>
          <div><dt className="text-slate-500 dark:text-slate-400">Tempo na equipe</dt><dd>{ingresso ? `${anosEntre(ingresso, hojeSP())} ano(s)` : "—"}</dd></div>
          <div><dt className="text-slate-500 dark:text-slate-400">Situação</dt><dd>{complemento?.situacaoEquipe ?? i.situacao ?? "ativo"}</dd></div>
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
        <h2 className="mb-3 font-semibold text-[#1f3a5f] dark:text-[#8fb3e6]">Láureas</h2>
        {laureas.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma concessão registrada.</p> : (
          <table className="mobile-cards w-full text-sm">
            <thead><tr className="text-left text-slate-600 dark:text-slate-400"><th className="pb-2">Grau</th><th className="pb-2">Concessão</th><th className="pb-2">Publicação</th><th className="pb-2">Boletim Interno Nº</th><th className="pb-2">Observação</th></tr></thead>
            <tbody>{laureas.map(l => (
              <tr key={l.id} className="border-t border-slate-100 dark:border-slate-800"><td className="py-1.5">{l.grau}</td><td>{formatBR(l.dataConcessao)}</td><td>{formatBR(l.dataPublicacao)}</td><td>{l.referencia || "—"}</td><td>{l.observacao || "—"}</td></tr>
            ))}</tbody>
          </table>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
        <h2 className="mb-3 font-semibold text-[#1f3a5f] dark:text-[#8fb3e6]">Elogios</h2>
        {elogios.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum elogio registrado.</p> : (
          <table className="mobile-cards w-full text-sm">
            <thead><tr className="text-left text-slate-600 dark:text-slate-400"><th className="pb-2">Título</th><th className="pb-2">Solicitação</th><th className="pb-2">Situação</th><th className="pb-2">Publicação</th><th className="pb-2">Boletim Interno Nº</th></tr></thead>
            <tbody>{elogios.map(e => (
              <tr key={e.id} className="border-t border-slate-100 dark:border-slate-800"><td className="py-1.5">{e.titulo}</td><td>{formatBR(e.dataSolicitacao)}</td><td>{e.situacao}</td><td>{formatBR(e.dataPublicacao)}</td><td>{e.referencia || "—"}</td></tr>
            ))}</tbody>
          </table>
        )}
      </section>
    </div>
  );
}
