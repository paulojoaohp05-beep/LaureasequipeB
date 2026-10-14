import { redirect } from "next/navigation";
import { obterLaureas, obterEfetivo } from "@/server/actions";
import { sessaoAtual } from "@/server/session";
import { LaureasClient } from "@/components/LaureasClient";

export const dynamic = "force-dynamic";

export default async function LaureasPage() {
  try {
    const s = await sessaoAtual();
    if (!s || !s.usuario.ativo) redirect("/login");
    const [laureas, efetivo] = await Promise.all([obterLaureas(), obterEfetivo()]);
    return <LaureasClient laureas={laureas} integrantes={efetivo} perfil={s.usuario.perfil} />;
  } catch { redirect("/login"); }
}
