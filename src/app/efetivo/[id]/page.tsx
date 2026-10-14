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
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Integrante excluído do efetivo{complemento.excluidoEm ? ` em ${formatBR(complemento.excluidoEm.slice(0, 10))}` : ""}{complemento.motivoExclusao ? ` — ${complemento.motivoExclusao}` : ""}
        </p>
      )}
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h1 className="text-xl font-semibold text-[#1f3a5f]">{i.nome}</h1>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
          <div><dt className="text-slate-500">Graduação</dt><dd>{i.graduacao}</dd></div>
          <div><dt className="text-slate-500">RE</dt><dd className="font-mono">{i.re}</dd></div>
          <div><dt className="text-slate-500">Nome de guerra</dt><dd>{i.nomeGuerra || "—"}</dd></div>
          <div><dt className="text-slate-500">Ingresso na PM</dt><dd>{formatBR(i.ingressoPM)}{!i.ingressoPM && <span className="text-xs text-amber-700"> pendente</span>}</dd></div>
          <div><dt className="text-slate-500">Ingresso na equipe</dt><dd>{formatBR(ingresso)}{!ingresso && <span className="text-xs text-amber-700"> pendente</span>}</dd></div>
          <div><dt className="text-slate-500">Tempo na equipe</dt><dd>{ingresso ? `${anosEntre(ingresso, hojeSP())} ano(s)` : "—"}</dd></div>
          <div><dt className="text-slate-500">Situação</dt><dd>{complemento?.situacaoEquipe ?? i.situacao ?? "ativo"}</dd></div>
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-[#1f3a5f]">Láureas</h2>
        {laureas.length === 0 ? <p className="text-sm text-slate-500">Nenhuma concessão registrada.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-600"><th className="pb-2">Grau</th><th className="pb-2">Concessão</th><th className="pb-2">Publicação</th><th className="pb-2">Referência</th><th className="pb-2">Observação</th></tr></thead>
            <tbody>{laureas.map(l => (
              <tr key={l.id} className="border-t border-slate-100"><td className="py-1.5">{l.grau}</td><td>{formatBR(l.dataConcessao)}</td><td>{formatBR(l.dataPublicacao)}</td><td>{l.referencia || "—"}</td><td>{l.observacao || "—"}</td></tr>
            ))}</tbody>
          </table>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-[#1f3a5f]">Elogios</h2>
        {elogios.length === 0 ? <p className="text-sm text-slate-500">Nenhum elogio registrado.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-600"><th className="pb-2">Título</th><th className="pb-2">Solicitação</th><th className="pb-2">Situação</th><th className="pb-2">Publicação</th><th className="pb-2">Referência</th></tr></thead>
            <tbody>{elogios.map(e => (
              <tr key={e.id} className="border-t border-slate-100"><td className="py-1.5">{e.titulo}</td><td>{formatBR(e.dataSolicitacao)}</td><td>{e.situacao}</td><td>{formatBR(e.dataPublicacao)}</td><td>{e.referencia || "—"}</td></tr>
            ))}</tbody>
          </table>
        )}
      </section>
    </div>
  );
}
