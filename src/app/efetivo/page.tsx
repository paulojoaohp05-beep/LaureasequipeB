import { redirect } from "next/navigation";
import { obterEfetivo } from "@/server/actions";
import { sessaoAtual } from "@/server/session";
import { EfetivoClient } from "@/components/EfetivoClient";

export const dynamic = "force-dynamic";

export default async function EfetivoPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  try {
    const s = await sessaoAtual();
    if (!s || !s.usuario.ativo) redirect("/login");
    const dados = await obterEfetivo({ incluirExcluidos: sp.excluidos === "1" });
    return <EfetivoClient itens={dados} perfil={s.usuario.perfil} />;
  } catch { redirect("/login"); }
}
