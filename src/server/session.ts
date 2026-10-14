// Sessão e autorização do módulo — somente servidor.
import "server-only";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { UsuarioModulo, Perfil } from "@/lib/types";
import { ErroPermissao } from "@/lib/elogios";

export interface Sessao {
  uid: string;
  email: string;
  usuario: UsuarioModulo;
}

/** Verifica o ID token do cookie httpOnly e carrega a autorização deste módulo. */
export async function sessaoAtual(): Promise<Sessao | null> {
  const store = await cookies();
  const token = store.get("session")?.value;
  if (!token) return null;
  try {
    // Session cookie (14 dias); fallback para ID token legado (~1h) ainda em cookies antigos.
    let dec;
    try { dec = await adminAuth.verifySessionCookie(token, false); }
    catch { dec = await adminAuth.verifyIdToken(token); }
    const doc = await adminDb.collection("moduloUsuarios").doc(dec.uid).get();
    if (!doc.exists) return { uid: dec.uid, email: dec.email ?? "", usuario: { uid: dec.uid, email: dec.email ?? "", equipeId: "", perfil: "visualizador", ativo: false } };
    const usuario = { uid: dec.uid, ...(doc.data() as Omit<UsuarioModulo, "uid">) };
    return { uid: dec.uid, email: dec.email ?? "", usuario };
  } catch {
    return null;
  }
}

/** Exige usuário autenticado e ATIVO neste módulo/equipe. */
export async function exigirSessao(): Promise<Sessao> {
  const s = await sessaoAtual();
  if (!s || !s.usuario.ativo) throw new ErroPermissao("Acesso não autorizado a este módulo");
  return s;
}

export async function exigirPerfil(...perfis: Perfil[]): Promise<Sessao> {
  const s = await exigirSessao();
  if (!perfis.includes(s.usuario.perfil)) throw new ErroPermissao();
  return s;
}
