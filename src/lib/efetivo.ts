// Montagem da atualização do complemento de efetivo — puro, sem I/O.
// Garante que entradas de auditoria nunca carreguem `undefined` (o Firestore rejeita
// esse valor; ignoreUndefinedProperties em admin.ts é apenas a rede de segurança).
import { isDataCivil } from "@/lib/dates";
import { ErroValidacao } from "@/lib/elogios";
import { normalizarCategoria, normalizarSat } from "@/lib/habilitacao";
import type { ComplementoEfetivo, GrauMedalha } from "@/lib/types";

export interface DadosMembro {
  nomeGuerra?: string;
  ingressoEquipe?: string;
  ingressoPM?: string;
  situacaoEquipe?: string;
  cnh?: string;
  sat?: string;
  medalhaRecebida?: string;
  medalhaRecebidaEm?: string;
}

const SITUACOES = ["ativo", "afastado", "transferido", "reserva"];
const GRAUS = ["bronze", "prata", "ouro"];

export function montarAtualizacaoComplemento(dados: DadosMembro, compAntes: Partial<ComplementoEfetivo>, hoje: string): {
  upd: Record<string, unknown>;
  campos: Record<string, { antes?: unknown; depois?: unknown }>;
  pendentes: string[];
} {
  const upd: Record<string, unknown> = {};
  const campos: Record<string, { antes?: unknown; depois?: unknown }> = {};
  const mudou = (k: string, antes: unknown, depois: unknown) => {
    upd[k] = depois;
    campos[k] = { ...(antes !== undefined ? { antes } : {}), depois };
  };

  for (const k of ["nomeGuerra", "ingressoEquipe", "ingressoPM"] as const) {
    const v = dados[k];
    if (v === undefined || v === "") continue; // vazio não limpa
    if (k !== "nomeGuerra") {
      if (!isDataCivil(v)) throw new ErroValidacao(k === "ingressoPM" ? "Data de ingresso na PM inválida" : "Data de ingresso na equipe inválida");
      if (v > hoje) throw new ErroValidacao("Data de ingresso não pode ser futura");
    }
    if (v !== compAntes[k]) mudou(k, compAntes[k], v);
  }

  if (dados.situacaoEquipe !== undefined) {
    if (!SITUACOES.includes(dados.situacaoEquipe)) throw new ErroValidacao("Situação na equipe inválida");
    const antes = compAntes.situacaoEquipe ?? "ativo"; // padrão implícito não é mudança
    if (dados.situacaoEquipe !== antes) mudou("situacaoEquipe", compAntes.situacaoEquipe, dados.situacaoEquipe);
  }

  for (const k of ["cnh", "sat"] as const) {
    if (dados[k] === undefined) continue;
    const normalizar = k === "sat" ? normalizarSat : normalizarCategoria;
    const v = normalizar(dados[k]);
    if (v !== normalizar(compAntes[k])) mudou(k, compAntes[k], v);
  }

  if (dados.medalhaRecebida !== undefined) {
    if (dados.medalhaRecebida === "") {
      if (compAntes.medalhaRecebida) {
        mudou("medalhaRecebida", compAntes.medalhaRecebida, "");
        if (compAntes.medalhaRecebidaEm) mudou("medalhaRecebidaEm", compAntes.medalhaRecebidaEm, "");
        else upd.medalhaRecebidaEm = "";
      }
    } else {
      if (!GRAUS.includes(dados.medalhaRecebida)) throw new ErroValidacao("Grau de medalha inválido");
      if (dados.medalhaRecebida !== (compAntes.medalhaRecebida ?? "")) mudou("medalhaRecebida", compAntes.medalhaRecebida, dados.medalhaRecebida as GrauMedalha);
    }
  }
  if (dados.medalhaRecebidaEm !== undefined && !(dados.medalhaRecebida === "" && upd.medalhaRecebidaEm === "")) {
    if (dados.medalhaRecebidaEm === "") {
      if (compAntes.medalhaRecebidaEm) mudou("medalhaRecebidaEm", compAntes.medalhaRecebidaEm, "");
    } else {
      if (!isDataCivil(dados.medalhaRecebidaEm)) throw new ErroValidacao("Data do recebimento inválida");
      if (dados.medalhaRecebidaEm > hoje) throw new ErroValidacao("Data do recebimento não pode ser futura");
      if (dados.medalhaRecebidaEm !== (compAntes.medalhaRecebidaEm ?? "")) mudou("medalhaRecebidaEm", compAntes.medalhaRecebidaEm, dados.medalhaRecebidaEm);
    }
  }

  const final = { ...compAntes, ...upd };
  if (final.medalhaRecebidaEm && !final.medalhaRecebida) throw new ErroValidacao("Informe o grau da medalha para registrar a data do recebimento");
  if (final.medalhaRecebidaEm && final.ingressoPM && final.medalhaRecebidaEm < final.ingressoPM) {
    throw new ErroValidacao("Data do recebimento não pode ser anterior ao ingresso na PM");
  }

  const pendentes: string[] = [];
  if (!final.ingressoEquipe) pendentes.push("ingressoEquipe");
  if (!final.ingressoPM) pendentes.push("ingressoPM");
  return { upd, campos, pendentes };
}
