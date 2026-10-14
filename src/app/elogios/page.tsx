import { redirect } from "next/navigation";
import { obterElogios, obterEfetivo } from "@/server/actions";
import { sessaoAtual } from "@/server/session";
import { ElogiosClient } from "@/components/ElogiosClient";

export const dynamic = "force-dynamic";

export default async function ElogiosPage() {
  try {
    const s = await sessaoAtual();
    if (!s || !s.usuario.ativo) redirect("/login");
    const [elogios, efetivo] = await Promise.all([obterElogios(), obterEfetivo()]);
    return <ElogiosClient elogios={elogios} integrantes={efetivo} perfil={s.usuario.perfil} />;
  } catch { redirect("/login"); }
}
