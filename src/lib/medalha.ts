// Medalha Valor Militar (PMESP): bronze 10, prata 20, ouro 30 anos de serviço.
// Prazo em anos conta-se pelo Código Civil art. 132 §3º: expira no dia de igual
// número do mês correspondente; se inexistente, no dia seguinte.
// Toda a matemática de datas é UTC — nunca usar parsing de data em horário local.
import { hojeSP, isDataCivil } from "@/lib/dates";
import type { GrauMedalha } from "@/lib/types";

export const GRAUS_MEDALHA = [
  { grau: "bronze", anos: 10, rotulo: "Bronze" },
  { grau: "prata", anos: 20, rotulo: "Prata" },
  { grau: "ouro", anos: 30, rotulo: "Ouro" },
] as const;

export const ROTULO_GRAU: Record<GrauMedalha, string> = { bronze: "Bronze", prata: "Prata", ouro: "Ouro" };

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Soma anos+meses a uma data civil AAAA-MM-DD. Quando o dia de igual número não
 *  existe no mês alvo, o prazo expira no dia seguinte (art. 132 §3º, CC). */
export function somarPrazo(data: string, anos: number, meses = 0): string {
  const [a, m, d] = data.split("-").map(Number);
  const total = (a * 12 + (m - 1)) + anos * 12 + meses;
  const y = Math.floor(total / 12), mo = (total % 12) + 1;
  const ultimo = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (d <= ultimo) return iso(y, mo, d);
  // dia inexistente no mês alvo → dia seguinte ao fim do mês (dia 1 do mês posterior)
  const depois = new Date(Date.UTC(y, mo, 1));
  return depois.toISOString().slice(0, 10);
}

function diffDias(de: string, ate: string): number {
  return Math.round((Date.parse(ate + "T00:00:00Z") - Date.parse(de + "T00:00:00Z")) / 86400000);
}

/** Tempo de serviço desde o ingresso até a data de referência. Null se inválido/futuro. */
export function tempoDeServico(ingresso: string, ref: string): { anos: number; meses: number; dias: number } | null {
  if (!isDataCivil(ingresso) || !isDataCivil(ref) || ingresso > ref) return null;
  let anos = 0;
  while (somarPrazo(ingresso, anos + 1) <= ref) anos++;
  let meses = 0;
  while (somarPrazo(ingresso, anos, meses + 1) <= ref) meses++;
  const base = somarPrazo(ingresso, anos, meses);
  return { anos, meses, dias: diffDias(base, ref) };
}

export type SituacaoMedalha = "sem-data" | "nao-faz-jus" | "pendente" | "pendente-superior" | "em-dia" | "verificar";

export const ROTULO_SITUACAO: Record<SituacaoMedalha, string> = {
  "sem-data": "Ingresso na PM não informado",
  "nao-faz-jus": "Ainda não faz jus",
  pendente: "Pendente de recebimento",
  "pendente-superior": "Pendente — faz jus a grau superior",
  "em-dia": "Recebida",
  verificar: "Verificar — recebida acima do tempo calculado",
};

export interface StatusMedalha {
  tempo: { anos: number; meses: number; dias: number } | null;
  devida: GrauMedalha | null;
  recebida: GrauMedalha | null;
  recebidaEm?: string;
  situacao: SituacaoMedalha;
  proxima: { grau: GrauMedalha; data: string } | null;
}

const RANK: Record<GrauMedalha, number> = { bronze: 1, prata: 2, ouro: 3 };

export function calcularMedalha(ingressoPM: string | undefined, recebida: unknown, recebidaEm?: string, ref = hojeSP()): StatusMedalha {
  const tempo = ingressoPM ? tempoDeServico(ingressoPM, ref) : null;
  const devida = !tempo ? null : tempo.anos >= 30 ? "ouro" : tempo.anos >= 20 ? "prata" : tempo.anos >= 10 ? "bronze" : null;
  const recebidaOk: GrauMedalha | null = recebida === "bronze" || recebida === "prata" || recebida === "ouro" ? recebida : null;

  let situacao: SituacaoMedalha;
  if (!tempo) situacao = "sem-data";
  else if (recebidaOk && RANK[recebidaOk] > (devida ? RANK[devida] : 0)) situacao = "verificar";
  else if (!devida) situacao = "nao-faz-jus";
  else if (!recebidaOk) situacao = "pendente";
  else if (RANK[recebidaOk] < RANK[devida]) situacao = "pendente-superior";
  else situacao = "em-dia";

  const prox = tempo ? GRAUS_MEDALHA.find(g => g.anos > tempo.anos) : undefined;
  return {
    tempo, devida, recebida: recebidaOk,
    ...(recebidaOk && recebidaEm ? { recebidaEm } : {}),
    situacao,
    proxima: tempo && prox ? { grau: prox.grau, data: somarPrazo(ingressoPM!, prox.anos) } : null,
  };
}
