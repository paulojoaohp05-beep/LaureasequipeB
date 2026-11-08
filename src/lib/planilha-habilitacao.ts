import * as XLSX from "xlsx";
import { normalizarCategoria, normalizarSat } from "./habilitacao";
export { normalizarCategoria } from "./habilitacao";

export interface LinhaHabilitacao {
  linha: number;
  graduacao: string;
  re: string;
  nome: string;
  cnh: string;
  sat: string;
}

export interface CadastroHabilitacao {
  id: string;
  re: string;
  nome: string;
  cnh?: string;
  sat?: string;
}

export interface LeituraHabilitacoes {
  linhas: LinhaHabilitacao[];
  invalidas: { linha: number; motivo: string }[];
}

export function lerPlanilhaHabilitacoes(buffer: Buffer | ArrayBuffer): LeituraHabilitacoes {
  const wb = XLSX.read(buffer, { type: "buffer", cellText: true });
  const ws = wb.Sheets.ANTIGUIDADE;
  if (!ws) throw new Error('A planilha deve conter a aba "ANTIGUIDADE".');
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: null });
  const headers = ["POST/GRAD", "RE", "DIG", "NOME", "CATEGORIA CNH", "CATEGORIA SAT"];
  const cabecalho = (rows[1] ?? []).map((v) => String(v ?? "").trim().toUpperCase());
  const indices = headers.map((header) => cabecalho.indexOf(header));
  if (indices.some((i) => i < 0)) {
    throw new Error("Cabeçalho inválido na linha 2 da aba ANTIGUIDADE.");
  }
  const linhas: LinhaHabilitacao[] = [];
  const invalidas: LeituraHabilitacoes["invalidas"] = [];
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (row.every((v) => !String(v ?? "").trim())) continue;
    // O arquivo real tem POST/GRAD mesclado sobre ordem + graduação.
    const gradIndex = indices[1] === indices[0] + 2 ? indices[0] + 1 : indices[0];
    const [graduacao, base, dig, nome] = [gradIndex, ...indices.slice(1, 4)].map((index) => String(row[index] ?? "").trim());
    if (!base || !dig || !nome) {
      invalidas.push({ linha: i + 1, motivo: "RE, dígito ou nome ausente" });
      continue;
    }
    linhas.push({ linha: i + 1, graduacao, re: `${base}-${dig.toUpperCase()}`, nome,
      cnh: normalizarCategoria(row[indices[4]]), sat: normalizarSat(row[indices[5]]) });
  }
  return { linhas, invalidas };
}

export type CamposHabilitacao = { cnh?: string; sat?: string };
export type ResultadoHabilitacao =
  | { tipo: "atualizar" | "inalterado" | "re-divergente"; linha: LinhaHabilitacao; integrante: CadastroHabilitacao; campos: CamposHabilitacao }
  | { tipo: "nao-encontrado"; linha: LinhaHabilitacao }
  | { tipo: "ambiguo"; linha: LinhaHabilitacao; candidatos: CadastroHabilitacao[] };

function normalizarNome(nome: string): string {
  return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

function primeiroNome(nome: string): string {
  return normalizarNome(nome).split(" ")[0];
}

export function reconciliarHabilitacoes(linhas: LinhaHabilitacao[], cadastro: CadastroHabilitacao[]) {
  const resultados: ResultadoHabilitacao[] = [];
  const resumo = { exatos: 0, atualizar: 0, inalterados: 0, reDivergentes: 0, naoEncontrados: 0, ambiguos: 0 };
  for (const linha of linhas) {
    const candidatos = cadastro.filter((c) => c.re.split("-")[0] === linha.re.split("-")[0] && primeiroNome(c.nome) === primeiroNome(linha.nome));
    const exato = candidatos.length === 1 && candidatos[0].re === linha.re;
    if (!candidatos.length) {
      resultados.push({ tipo: "nao-encontrado", linha });
      resumo.naoEncontrados++;
    } else if (candidatos.length > 1) {
      resultados.push({ tipo: "ambiguo", linha, candidatos });
      resumo.ambiguos++;
    } else {
      const integrante = candidatos[0];
      const campos: CamposHabilitacao = {};
      // Importação nunca apaga uma habilitação existente quando a célula está vazia.
      // Diferente da edição manual, somente categorias preenchidas geram alterações.
      for (const campo of ["cnh", "sat"] as const) {
        const normalizar = campo === "sat" ? normalizarSat : normalizarCategoria;
        const valor = normalizar(linha[campo]);
        if (valor && valor !== normalizar(integrante[campo])) campos[campo] = valor;
      }
      const mudou = Object.keys(campos).length > 0;
      const tipo = !exato ? "re-divergente" : mudou ? "atualizar" : "inalterado";
      resultados.push({ tipo, linha, integrante, campos });
      if (exato) resumo.exatos++;
      else resumo.reDivergentes++;
      if (mudou) resumo.atualizar++;
      else resumo.inalterados++;
    }
  }
  return { resultados, resumo };
}
