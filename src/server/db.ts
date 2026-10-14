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
  const comps = new Map(c.docs.map(d => [d.id, d.data() as ComplementoEfetivo]));
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
