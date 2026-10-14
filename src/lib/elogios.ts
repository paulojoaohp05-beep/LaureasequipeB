// Máquina de estados e regras de elogios — validada no servidor.
import type { Elogio, Perfil, SituacaoElogio } from "./types";

export const TRANSICOES: Record<SituacaoElogio, SituacaoElogio[]> = {
  rascunho: ["solicitado", "cancelado"],
  solicitado: ["publicado", "negado", "cancelado"],
  publicado: [],
  negado: [],
  cancelado: [],
};

export function podeTransitar(de: SituacaoElogio, para: SituacaoElogio): boolean {
  return TRANSICOES[de].includes(para);
}

export class ErroPermissao extends Error { constructor(m = "Sem permissão para esta operação") { super(m); this.name = "ErroPermissao"; } }
export class ErroValidacao extends Error { constructor(m: string) { super(m); this.name = "ErroValidacao"; } }

export function assertTransicao(e: Elogio, para: SituacaoElogio) {
  if (!podeTransitar(e.situacao, para)) throw new ErroValidacao(`Transição inválida: ${e.situacao} → ${para}`);
}

/** Admin e gestor editam qualquer registro não publicado. Editor edita apenas as próprias solicitações não publicadas. */
export function assertPodeEditar(e: Elogio, perfil: Perfil, uid: string) {
  if (perfil === "admin" || perfil === "gestor") {
    if (e.situacao === "publicado" || e.situacao === "negado") throw new ErroPermissao();
    return;
  }
  if (perfil === "editor" && e.lancadoPorUid === uid && (e.situacao === "rascunho" || e.situacao === "solicitado")) return;
  throw new ErroPermissao();
}

export function assertPodePublicarOuCancelar(perfil: Perfil) {
  if (perfil !== "admin" && perfil !== "gestor") throw new ErroPermissao("Somente administrador ou gestor publica, nega ou cancela registros");
}

export function assertPublicacaoCompleta(campos: { dataPublicacao?: string; referencia?: string }) {
  if (!campos.dataPublicacao) throw new ErroValidacao("Data de publicação é obrigatória para publicar");
  if (!campos.referencia?.trim()) throw new ErroValidacao("Boletim Interno Nº é obrigatório para publicar");
}

/** Correção de registros publicados/negados (sem mudar situação): só admin/gestor. */
export function assertPodeCorrigir(perfil: Perfil) {
  if (perfil !== "admin" && perfil !== "gestor") throw new ErroPermissao("Somente administrador ou gestor corrige registros");
}

/** Exclusão física de elogio: admin/gestor qualquer; editor só o próprio e apenas rascunho/solicitado. */
export function assertPodeExcluirElogio(e: Elogio, perfil: Perfil, uid: string) {
  if (perfil === "admin" || perfil === "gestor") return;
  if (perfil === "editor") assertPodeEditar(e, perfil, uid);
  else throw new ErroPermissao();
}

/** Solicitante pode ser o próprio usuário vinculado (editor) ou escolhido por admin/gestor. */
export function assertSolicitante(perfil: Perfil, solicitanteId: string, integranteVinculadoId?: string) {
  if (perfil === "admin" || perfil === "gestor") return;
  if (perfil === "editor") {
    if (!integranteVinculadoId) throw new ErroPermissao("Usuário sem vínculo com integrante não pode lançar em nome próprio");
    if (solicitanteId !== integranteVinculadoId) throw new ErroPermissao("Editor só pode lançar solicitado por si mesmo");
    return;
  }
  throw new ErroPermissao();
}
