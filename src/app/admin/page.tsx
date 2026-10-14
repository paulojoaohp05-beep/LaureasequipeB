import { redirect } from "next/navigation";
import { sessaoAtual } from "@/server/session";
import { listarUsuariosAdmin, obterEfetivo } from "@/server/actions";
import { AdminClient } from "@/components/AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const s = await sessaoAtual();
  if (!s?.usuario.ativo) redirect("/login");
  if (s.usuario.perfil !== "admin") {
    return <p className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Acesso restrito a administradores.</p>;
  }
  const [usuarios, efetivo] = await Promise.all([listarUsuariosAdmin(), obterEfetivo()]);
  return <AdminClient usuarios={usuarios} integrantes={efetivo} />;
}
