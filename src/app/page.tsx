import { redirect } from "next/navigation";
import { obterDashboard } from "@/server/actions";
import { sessaoAtual } from "@/server/session";
import { DashboardClient } from "@/components/DashboardClient";
import type { FiltroPeriodo } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await sessaoAtual();
  if (!s || !s.usuario.ativo) redirect("/login");
  const filtro: FiltroPeriodo = {
    tipo: (sp.periodo as FiltroPeriodo["tipo"]) ?? "mes-atual",
    de: sp.de, ate: sp.ate,
    criterio: (sp.criterio as FiltroPeriodo["criterio"]) ?? "solicitacao",
  };
  const dados = await obterDashboard(filtro);
  return <DashboardClient dados={dados} filtro={filtro} />;
}
