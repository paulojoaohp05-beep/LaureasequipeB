import { redirect } from "next/navigation";
import { obterEfetivo } from "@/server/actions";
import { EfetivoClient } from "@/components/EfetivoClient";

export const dynamic = "force-dynamic";

export default async function EfetivoPage() {
  let dados;
  try { dados = await obterEfetivo(); } catch { redirect("/login"); }
  return <EfetivoClient itens={dados} />;
}
