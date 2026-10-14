// Acesso a dados do módulo via Admin SDK. Todas as consultas são filtradas por equipe.
// O adaptador do cadastro mestre isola os nomes de campos do legado em um único lugar.
import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { createHash } from "crypto";
import type { Auditoria, ComplementoEfetivo, Elogio, Integrante, Laurea, UsuarioModulo } from "@/lib/types";

export const COL = {
  integrantes: "integrantes",
  complementos: "efetivoComplementos",
  usuarios: "moduloUsuarios",
  elogios: "elogios",
  laureas: "laureas",
  auditoria: "auditoria",
  importacoes: "importacoes",
} as const;

export function nowTs() { return Timestamp.now(); }
export function hashArquivo(buf: Buffer) { return createHash("sha256").update(buf).digest("hex"); }

// ---------- Integrantes ----------
export async function listarIntegrantes(): Promise<Integrante[]> {
  const s = await adminDb.collection(COL.integrantes).orderBy("nome").get();
  return s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Integrante, "id">) }));
}
export async function buscarIntegrante(id: string): Promise<Integrante | null> {
  const d = await adminDb.collection(COL.integrantes).doc(id).get();
  return d.exists ? { id: d.id, ...(d.data() as Omit<Integrante, "id">) } : null;
}
export async function complementoDe(integranteId: string): Promise<ComplementoEfetivo | null> {
  const d = await adminDb.collection(COL.complementos).doc(integranteId).get();
  return d.exists ? (d.data() as ComplementoEfetivo) : null;
}

// ---------- Elogios ----------
export async function listarElogios(equipeId: string): Promise<Elogio[]> {
  const s = await adminDb.collection(COL.elogios).where("equipeId", "==", equipeId).orderBy("dataSolicitacao", "desc").get();
  return s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Elogio, "id">) }));
}
export async function buscarElogio(id: string): Promise<Elogio | null> {
  const d = await adminDb.collection(COL.elogios).doc(id).get();
  return d.exists ? { id: d.id, ...(d.data() as Omit<Elogio, "id">) } : null;
}

// ---------- Láureas ----------
export async function listarLaureas(equipeId: string): Promise<Laurea[]> {
  const s = await adminDb.collection(COL.laureas).where("equipeId", "==", equipeId).get();
  return s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Laurea, "id">) }));
}
export async function laureasDoIntegrante(integranteId: string): Promise<Laurea[]> {
  const s = await adminDb.collection(COL.laureas).where("integranteId", "==", integranteId).orderBy("dataConcessao").get();
  return s.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Laurea, "id">) }));
}

// ---------- Auditoria ----------
export async function auditar(a: Omit<Auditoria, "em">) {
  await adminDb.collection(COL.auditoria).add({ ...a, em: FieldValue.serverTimestamp() });
}

// ---------- Usuários do módulo ----------
export async function listarUsuarios(): Promise<UsuarioModulo[]> {
  const s = await adminDb.collection(COL.usuarios).get();
  return s.docs.map(d => ({ uid: d.id, ...(d.data() as Omit<UsuarioModulo, "uid">) }));
}
export async function buscarUsuario(uid: string): Promise<UsuarioModulo | null> {
  const d = await adminDb.collection(COL.usuarios).doc(uid).get();
  return d.exists ? { uid: d.id, ...(d.data() as Omit<UsuarioModulo, "uid">) } : null;
}
export async function contarAdminsAtivos(): Promise<number> {
  const s = await adminDb.collection(COL.usuarios).where("perfil", "==", "admin").where("ativo", "==", true).get();
  return s.size;
}
