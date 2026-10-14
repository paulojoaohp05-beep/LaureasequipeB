// Leitura e reconciliação da planilha "EQ B - EFETIVO.xlsx" (aba EFETIVO-2026).
// Nunca altera o arquivo de origem; RE é sempre texto.
import * as XLSX from "xlsx";
import { createHash } from "crypto";
import type { Integrante } from "./types";

export function hashPlanilhaRe(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export interface LinhaPlanilha {
  linha: number; // número da linha na planilha (1-based)
  graduacao: string;
  re: string;
  nome: string;
  funcao: string;
}

export interface LeituraPlanilha {
  linhas: LinhaPlanilha[];
  invalidas: { linha: number; motivo: string }[];
  resumoRodape?: { oficiais: number; subtenSgt: number; cabos: number; soldados: number };
  divergenciaRodape?: string;
  porGraduacao: Record<string, number>;
}

const GRAD_GRUPO: Record<string, "oficiais" | "subtenSgt" | "cabos" | "soldados"> = {
  "CAP PM": "oficiais", "1º TEN PM": "oficiais", "2º TEN PM": "oficiais", "MAJ PM": "oficiais",
  "SUBTEN PM": "subtenSgt", "1º SGT PM": "subtenSgt", "2º SGT PM": "subtenSgt", "3º SGT PM": "subtenSgt",
  "CB PM": "cabos", "SD PM": "soldados",
};

/** RE é texto: preserva zeros à esquerda, hífen e sufixo "-A". Apara espaços externos. */
export function normalizarRE(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}

export function lerPlanilha(buffer: Buffer | ArrayBuffer): LeituraPlanilha {
  const wb = XLSX.read(buffer, { type: "buffer", cellText: true });
  const aba = wb.SheetNames[0];
  const ws = wb.Sheets[aba];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: null });

  const linhas: LinhaPlanilha[] = [];
  const invalidas: { linha: number; motivo: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const linha = i + 1;
    // Colunas: A ordem | B graduação | C RE | D nome | E função
    const grad = String(r[1] ?? "").trim();
    const re = normalizarRE(r[2]);
    const nome = String(r[3] ?? "").trim();
    const funcao = String(r[4] ?? "").trim();
    if (!re && !nome && !grad) continue; // ignora vazias/título/resumo
    if (!re || !nome) { invalidas.push({ linha, motivo: "RE ou nome ausente" }); continue; }
    if (!grad) { invalidas.push({ linha, motivo: "graduação ausente" }); continue; }
    linhas.push({ linha, graduacao: grad, re, nome, funcao });
  }

  const porGraduacao: Record<string, number> = {};
  for (const l of linhas) porGraduacao[l.graduacao] = (porGraduacao[l.graduacao] ?? 0) + 1;

  // Rodapé de controle (B110:C113 no arquivo de referência): procura padrão numérico
  let resumoRodape: LeituraPlanilha["resumoRodape"];
  let divergenciaRodape: string | undefined;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const rotulo = String(r[1] ?? "").trim().toLowerCase();
    const val = typeof r[2] === "number" ? r[2] : Number(String(r[2] ?? "").trim());
    if (isNaN(val)) continue;
    if (rotulo.startsWith("oficiais")) resumoRodape = { ...(resumoRodape ?? {}), oficiais: val } as typeof resumoRodape;
    else if (rotulo.includes("sub") || rotulo.includes("sgt")) resumoRodape = { ...(resumoRodape ?? {}), subtenSgt: val } as typeof resumoRodape;
    else if (rotulo === "cb" || rotulo.startsWith("cabos")) resumoRodape = { ...(resumoRodape ?? {}), cabos: val } as typeof resumoRodape;
    else if (rotulo === "sd" || rotulo.startsWith("soldados")) resumoRodape = { ...(resumoRodape ?? {}), soldados: val } as typeof resumoRodape;
  }
  if (resumoRodape) {
    const grupos = { oficiais: 0, subtenSgt: 0, cabos: 0, soldados: 0 };
    for (const l of linhas) { const g = GRAD_GRUPO[l.graduacao]; if (g) grupos[g]++; }
    const difs: string[] = [];
    if (resumoRodape.oficiais !== undefined && resumoRodape.oficiais !== grupos.oficiais) difs.push(`oficiais: rodapé ${resumoRodape.oficiais} × linhas ${grupos.oficiais}`);
    if (resumoRodape.subtenSgt !== undefined && resumoRodape.subtenSgt !== grupos.subtenSgt) difs.push(`subten/sgt: rodapé ${resumoRodape.subtenSgt} × linhas ${grupos.subtenSgt}`);
    if (resumoRodape.cabos !== undefined && resumoRodape.cabos !== grupos.cabos) difs.push(`cabos: rodapé ${resumoRodape.cabos} × linhas ${grupos.cabos}`);
    if (resumoRodape.soldados !== undefined && resumoRodape.soldados !== grupos.soldados) difs.push(`soldados: rodapé ${resumoRodape.soldados} × linhas ${grupos.soldados}`);
    if (difs.length) divergenciaRodape = difs.join("; ");
  }

  return { linhas, invalidas, resumoRodape, divergenciaRodape, porGraduacao };
}

export type ResultadoLinha =
  | { tipo: "inalterado"; integrante: Integrante }
  | { tipo: "complemento"; integrante: Integrante; campos: string[]; linha: LinhaPlanilha }
  | { tipo: "divergente"; integrante: Integrante; diffs: { campo: string; planilha: string; cadastro: string }[] }
  | { tipo: "nao-encontrado"; linha: LinhaPlanilha }
  | { tipo: "ambiguas"; linha: LinhaPlanilha; candidatos: Integrante[] };

/**
 * Cruza linhas da planilha com o cadastro por RE (identificador confiável).
 * Nunca une por nome aproximado. Valores vazios da planilha não limpam o cadastro.
 */
export function reconciliar(linhas: LinhaPlanilha[], cadastro: Integrante[]): {
  resultados: ResultadoLinha[];
  resumo: { existentes: number; complementos: number; divergencias: number; naoEncontrados: number; ambiguos: number };
} {
  const porRE = new Map<string, Integrante[]>();
  for (const c of cadastro) {
    const k = c.re;
    if (!porRE.has(k)) porRE.set(k, []);
    porRE.get(k)!.push(c);
  }
  const resultados: ResultadoLinha[] = [];
  const resumo = { existentes: 0, complementos: 0, divergencias: 0, naoEncontrados: 0, ambiguos: 0 };

  for (const l of linhas) {
    const cand = porRE.get(l.re) ?? [];
    if (cand.length === 0) { resumo.naoEncontrados++; resultados.push({ tipo: "nao-encontrado", linha: l }); continue; }
    if (cand.length > 1) { resumo.ambiguos++; resultados.push({ tipo: "ambiguas", linha: l, candidatos: cand }); continue; }
    const c = cand[0];
    const diffs: { campo: string; planilha: string; cadastro: string }[] = [];
    if (l.graduacao && c.graduacao && l.graduacao !== c.graduacao) diffs.push({ campo: "graduacao", planilha: l.graduacao, cadastro: c.graduacao });
    if (l.nome && c.nome && l.nome !== c.nome) diffs.push({ campo: "nome", planilha: l.nome, cadastro: c.nome });
    if (l.funcao && (c.funcao ?? "") !== l.funcao) {
      if (!c.funcao) { resumo.complementos++; resultados.push({ tipo: "complemento", integrante: c, campos: ["funcao"], linha: l }); continue; }
      diffs.push({ campo: "funcao", planilha: l.funcao, cadastro: c.funcao });
    }
    if (diffs.length) { resumo.divergencias++; resultados.push({ tipo: "divergente", integrante: c, diffs }); }
    else { resumo.existentes++; resultados.push({ tipo: "inalterado", integrante: c }); }
  }
  return { resultados, resumo };
}
