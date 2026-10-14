import { redirect } from "next/navigation";
import { obterElogios, obterEfetivo } from "@/server/actions";
import { ElogiosClient } from "@/components/ElogiosClient";

export const dynamic = "force-dynamic";

export default async function ElogiosPage() {
  try {
    const [elogios, efetivo] = await Promise.all([obterElogios(), obterEfetivo()]);
    return <ElogiosClient elogios={elogios} integrantes={efetivo} />;
  } catch { redirect("/login"); }
}
