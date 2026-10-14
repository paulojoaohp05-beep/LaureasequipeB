// Máquina de estados e regras de elogios — validada no servidor.
import type { Elogio, Perfil, SituacaoElogio } from "./types";

export const TRANSICOES: Record<SituacaoElogio, SituacaoElogio[]> = {
  rascunho: ["solicitado", "cancelado"],
  solicitado: ["publicado", "cancelado"],
  publicado: [],
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

/** Somente admin publica/cancela. Editor edita apenas as próprias solicitações não publicadas. */
export function assertPodeEditar(e: Elogio, perfil: Perfil, uid: string) {
  if (perfil === "admin") return;
  if (perfil === "editor" && e.lancadoPorUid === uid && (e.situacao === "rascunho" || e.situacao === "solicitado")) return;
  throw new ErroPermissao();
}

export function assertPodePublicarOuCancelar(perfil: Perfil) {
  if (perfil !== "admin") throw new ErroPermissao("Somente administrador publica ou cancela registros");
}

export function assertPublicacaoCompleta(campos: { dataPublicacao?: string; referencia?: string }) {
  if (!campos.dataPublicacao) throw new ErroValidacao("Data de publicação é obrigatória para publicar");
  if (!campos.referencia?.trim()) throw new ErroValidacao("Referência do boletim/documento é obrigatória para publicar");
}

/** Solicitante pode ser o próprio usuário vinculado (editor) ou escolhido por admin. */
export function assertSolicitante(perfil: Perfil, solicitanteId: string, integranteVinculadoId?: string) {
  if (perfil === "admin") return;
  if (perfil === "editor") {
    if (!integranteVinculadoId) throw new ErroPermissao("Usuário sem vínculo com integrante não pode lançar em nome próprio");
    if (solicitanteId !== integranteVinculadoId) throw new ErroPermissao("Editor só pode lançar solicitado por si mesmo");
    return;
  }
  throw new ErroPermissao();
}
