// Tipos do módulo de controle de láureas e elogios — Equipe B.

export type Perfil = "admin" | "editor" | "visualizador";

export type SituacaoIntegrante = "ativo" | "afastado" | "transferido" | "reserva";

/** Cadastro mestre do integrante (fonte única, adaptável ao Firebase real). */
export interface Integrante {
  id: string;
  graduacao: string; // ex.: "CB PM", "1º SGT PM"
  re: string; // sempre texto, preserva zeros/hífen/sufixo "-A"
  nome: string;
  nomeGuerra?: string;
  funcao?: string;
  situacao?: SituacaoIntegrante | string; // conforme existente no cadastro
  ingressoPM?: string; // data civil AAAA-MM-DD
}

/** Complemento deste módulo — nunca substitui o cadastro mestre.
 *  No projeto gestaocaixasemestral, `membros` só tem re/nome/posto_grad/pago_*;
 *  campos que o módulo precisa (funcao, nomeGuerra, situação, datas) moram aqui. */
export interface ComplementoEfetivo {
  integranteId: string;
  ingressoEquipe?: string; // AAAA-MM-DD; ausente = pendente
  ingressoPM?: string;
  nomeGuerra?: string;
  funcao?: string;
  situacaoEquipe?: string;
  camposPendentes?: string[];
  schemaVersion: number;
}

export interface UsuarioModulo {
  uid: string; // Firebase UID
  email: string;
  integranteId?: string; // vínculo confirmado; nunca deduzido por e-mail/nome
  equipeId: string;
  perfil: Perfil;
  ativo: boolean;
  criadoEm?: string;
  criadoPor?: string;
}

export type SituacaoElogio = "rascunho" | "solicitado" | "publicado" | "cancelado";

export interface Elogio {
  id: string;
  equipeId: string;
  destinatarioIds: string[]; // reconhecimento coletivo suportado
  solicitanteId: string; // sargento proponente (integrante)
  lancadoPorUid: string; // usuário autenticado que digitou
  titulo: string;
  descricao?: string;
  dataSolicitacao: string; // AAAA-MM-DD
  situacao: SituacaoElogio;
  dataPublicacao?: string;
  referencia?: string; // boletim/documento
  justificativaCancelamento?: string;
  criadoEm?: string;
  atualizadoEm?: string;
  publicadoEm?: string;
  canceladoEm?: string;
  publicadoPorUid?: string;
  canceladoPorUid?: string;
}

export interface Laurea {
  id: string;
  equipeId: string;
  integranteId: string;
  grau: string; // "1º".."5º" — nomenclatura a confirmar com a equipe
  dataConcessao: string; // AAAA-MM-DD
  dataPublicacao?: string;
  referencia?: string;
  solicitanteId?: string; // opcional em concessões históricas
  observacao?: string;
  criadoEm?: string;
  criadoPorUid?: string;
}

export interface Auditoria {
  id?: string;
  acao: string;
  entidade: string;
  entidadeId: string;
  autorUid: string;
  autorEmail?: string;
  em?: string; // timestamp do servidor
  campos?: Record<string, { antes?: unknown; depois?: unknown }>;
}

export interface Importacao {
  id?: string;
  equipeId: string;
  arquivoHash: string;
  arquivoNome: string;
  autorUid: string;
  iniciadoEm?: string;
  concluidoEm?: string;
  modo: "simulacao" | "gravacao";
  resumo: {
    lidas: number;
    existentes: number;
    complementos: number;
    divergencias: number;
    naoEncontrados: number;
    invalidas: number;
    criados: number;
    aplicados: number;
  };
}

export type CriterioData = "solicitacao" | "publicacao" | "concessao";

export interface FiltroPeriodo {
  tipo: "mes-atual" | "ultimos-6" | "ultimos-12" | "personalizado";
  de?: string;
  ate?: string;
  criterio: CriterioData;
}

export const EQUipeId = "equipe-b";
