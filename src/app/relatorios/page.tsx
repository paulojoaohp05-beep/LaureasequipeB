import { redirect } from "next/navigation";
import { sessaoAtual } from "@/server/session";
import { RelatoriosClient } from "@/components/RelatoriosClient";

export const dynamic = "force-dynamic";

export default async function RelatoriosPage() {
  const s = await sessaoAtual();
  if (!s?.usuario.ativo) redirect("/login");
  return <RelatoriosClient />;
}
