// Wrapper de servidor: resolve o perfil da sessão no servidor e repassa ao Nav (cliente).
import { sessaoAtual } from "@/server/session";
import { Nav } from "./Nav";

export async function NavServer() {
  const s = await sessaoAtual();
  return <Nav perfil={s?.usuario.perfil ?? null} />;
}
