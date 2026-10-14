// Acesso a dados do módulo via Admin SDK. Todas as consultas são filtradas por equipe.
// ADAPTADOR DO LEGADO (projeto gestaocaixasemestral):
//   - Cadastro mestre: coleção `membros` — campos canônicos re(string), nome(string), posto_grad(string),
//     pago_semestre_1/pago_semestre_2(integer, pertencem à Gestão de Caixa — não tocar).
//   - O módulo NÃO escreve em `membros`. Dados próprios vão em coleções separadas.
import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { createHash } from "crypto";
import type { Auditoria, ComplementoEfetivo, Elogio, Integrante, Laurea, UsuarioModulo } from "@/lib/types";

export const COL = {
  membros: "membros",               // cadastro mestre (legado — somente leitura)
  complementos: "efetivoComplementos", // coleção do módulo, chave = ID do doc em membros
  usuarios: "moduloUsuarios",
  elogios: "elogios",
  laureas: "laureas",
  auditoria: "auditoria",
  importacoes: "importacoes",
} as const;

export function nowTs() { return Timestamp.now(); }

// Converte Timestamps do Firestore em strings ISO, recursivamente, para que os
// dados possam cruzar a fronteira Server Component -> Client Component.
export function plain<T>(data: FirebaseFirestore.DocumentData): T {
  if (data instanceof Timestamp) return data.toDate().toISOString() as T;
  if (Array.isArray(data)) return data.map(v => plain(v)) as T;
  if (data !== null && typeof data === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) out[k] = plain(v);
    return out as T;
  }
  return data as T;
}
export function hashArquivo(buf: Buffer) { return createHash("sha256").update(buf).digest("hex"); }

// Mapeamento legado → visão do módulo. Campos do legado: re, nome, posto_grad.
// Campos inexistentes no legado (funcao, nomeGuerra, situacao, ingressoPM) moram no complemento.
function mapearMembro(id: string, d: FirebaseFirestore.DocumentData, c?: ComplementoEfetivo | null): Integrante {
  return {
    id,
    re: String(d.re ?? ""),
    nome: String(d.nome ?? ""),
    graduacao: String(d.posto_grad ?? ""),
    nomeGuerra: c?.nomeGuerra,
    funcao: c?.funcao,
    situacao: c?.situacaoEquipe ?? "ativo",
    ingressoPM: c?.ingressoPM,
  };
}

// ---------- Integrantes (mestre `membros` + complemento do módulo) ----------
export async function listarIntegrantes(): Promise<(Integrante & { complemento: ComplementoEfetivo | null })[]> {
  const [m, c] = await Promise.all([
    adminDb.collection(COL.membros).orderBy("nome").get(),
    adminDb.collection(COL.complementos).get(),
  ]);
  const comps = new Map(c.docs.map(d => [d.id, plain<ComplementoEfetivo>(d.data())]));
  return m.docs.map(d => {
    const comp = comps.get(d.id) ?? null;
    return { ...mapearMembro(d.id, d.data(), comp), complemento: comp };
  });
}
export async function buscarIntegrante(id: string): Promise<(Integrante & { complemento: ComplementoEfetivo | null }) | null> {
  const d = await adminDb.collection(COL.membros).doc(id).get();
  if (!d.exists) return null;
  const comp = await complementoDe(id);
  return { ...mapearMembro(d.id, d.data()!, comp), complemento: comp };
}
export async function complementoDe(integranteId: string): Promise<ComplementoEfetivo | null> {
  const d = await adminDb.collection(COL.complementos).doc(integranteId).get();
  return d.exists ? plain<ComplementoEfetivo>(d.data()!) : null;
}

// ---------- Elogios ----------
export async function listarElogios(equipeId: string): Promise<Elogio[]> {
  const s = await adminDb.collection(COL.elogios).where("equipeId", "==", equipeId).orderBy("dataSolicitacao", "desc").get();
  return s.docs.map(d => ({ id: d.id, ...plain<Omit<Elogio, "id">>(d.data()) }));
}
export async function buscarElogio(id: string): Promise<Elogio | null> {
  const d = await adminDb.collection(COL.elogios).doc(id).get();
  return d.exists ? { id: d.id, ...plain<Omit<Elogio, "id">>(d.data()!) } : null;
}

// ---------- Láureas ----------
export async function listarLaureas(equipeId: string): Promise<Laurea[]> {
  const s = await adminDb.collection(COL.laureas).where("equipeId", "==", equipeId).get();
  return s.docs.map(d => ({ id: d.id, ...plain<Omit<Laurea, "id">>(d.data()) }));
}
export async function laureasDoIntegrante(integranteId: string): Promise<Laurea[]> {
  const s = await adminDb.collection(COL.laureas).where("integranteId", "==", integranteId).orderBy("dataConcessao").get();
  return s.docs.map(d => ({ id: d.id, ...plain<Omit<Laurea, "id">>(d.data()) }));
}

// ---------- Auditoria ----------
export async function auditar(a: Omit<Auditoria, "em">) {
  await adminDb.collection(COL.auditoria).add({ ...a, em: FieldValue.serverTimestamp() });
}

// ---------- Usuários do módulo ----------
export async function listarUsuarios(): Promise<UsuarioModulo[]> {
  const s = await adminDb.collection(COL.usuarios).get();
  return s.docs.map(d => ({ uid: d.id, ...plain<Omit<UsuarioModulo, "uid">>(d.data()) }));
}
export async function buscarUsuario(uid: string): Promise<UsuarioModulo | null> {
  const d = await adminDb.collection(COL.usuarios).doc(uid).get();
  return d.exists ? { uid: d.id, ...plain<Omit<UsuarioModulo, "uid">>(d.data()!) } : null;
}
export async function contarAdminsAtivos(): Promise<number> {
  const s = await adminDb.collection(COL.usuarios).where("perfil", "==", "admin").where("ativo", "==", true).get();
  return s.size;
}
