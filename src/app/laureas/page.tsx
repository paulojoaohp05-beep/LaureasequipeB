import { redirect } from "next/navigation";
import { obterLaureas, obterEfetivo } from "@/server/actions";
import { LaureasClient } from "@/components/LaureasClient";

export const dynamic = "force-dynamic";

export default async function LaureasPage() {
  try {
    const [laureas, efetivo] = await Promise.all([obterLaureas(), obterEfetivo()]);
    return <LaureasClient laureas={laureas} integrantes={efetivo} />;
  } catch { redirect("/login"); }
}
