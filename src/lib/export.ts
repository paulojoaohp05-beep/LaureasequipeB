// Geração de arquivos Excel .xlsx reais (exceljs) — somente servidor.
import ExcelJS from "exceljs";
import { formatBR } from "./dates";
import type { Elogio, Integrante, Laurea } from "./types";

/** Evita injeção de fórmula: conteúdo do usuário nunca começa com = + - @ */
function seguro(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /^[=+\-@]/.test(s) ? `'${s}` : s;
}

function cabecalho(ws: ExcelJS.Worksheet, titulos: string[]) {
  const row = ws.addRow(titulos);
  row.font = { bold: true };
  row.eachCell(c => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A5F" } }; c.font = { bold: true, color: { argb: "FFFFFFFF" } }; });
  ws.columns.forEach(c => { c.width = 22; });
}

function meta(ws: ExcelJS.Worksheet, filtros: string, geradoEm: Date) {
  ws.spliceRows(1, 0, [`Relatório gerado em ${geradoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} — filtros: ${filtros}`], []);
}

export async function xlsxEfetivo(items: (Integrante & { ingressoEquipe?: string; totalElogiosPublicados?: number | null; laureaVigente?: { grau: string; data: string } | null })[], filtros: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Efetivo");
  cabecalho(ws, ["Graduação", "RE", "Nome", "Nome de guerra", "Situação", "Ingresso PM", "Ingresso na equipe", "Elogios publicados", "Láurea vigente", "Data láurea"]);
  for (const i of items) ws.addRow([seguro(i.graduacao), seguro(i.re), seguro(i.nome), seguro(i.nomeGuerra), seguro(i.situacao), formatBR(i.ingressoPM), formatBR(i.ingressoEquipe), i.totalElogiosPublicados ?? "", i.laureaVigente?.grau ?? "", i.laureaVigente ? formatBR(i.laureaVigente.data) : ""]);
  meta(ws, filtros, new Date());
  ws.getColumn(2).numFmt = "@"; // RE como texto
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function xlsxElogios(items: Elogio[], nomes: Map<string, string>, filtros: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Elogios");
  cabecalho(ws, ["Título", "Destinatário(s)", "Solicitante", "Data da solicitação", "Situação", "Data de publicação", "Boletim Interno Nº", "Justificativa (negado/cancelado)"]);
  for (const e of items) ws.addRow([
    seguro(e.titulo), seguro(e.destinatarioIds.map(id => nomes.get(id) ?? id).join(", ")), seguro(nomes.get(e.solicitanteId) ?? e.solicitanteId),
    formatBR(e.dataSolicitacao), seguro(e.situacao), formatBR(e.dataPublicacao), seguro(e.referencia), seguro(e.justificativaNegativa ?? e.justificativaCancelamento),
  ]);
  meta(ws, filtros, new Date());
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function xlsxLaureas(items: Laurea[], nomes: Map<string, string>, filtros: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Laureas");
  cabecalho(ws, ["Integrante", "Grau", "Data da concessão", "Data de publicação", "Boletim Interno Nº", "Observação"]);
  for (const l of items) ws.addRow([seguro(nomes.get(l.integranteId) ?? l.integranteId), seguro(l.grau), formatBR(l.dataConcessao), formatBR(l.dataPublicacao), seguro(l.referencia), seguro(l.observacao)]);
  meta(ws, filtros, new Date());
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function xlsxParticipacao(linhas: { sargento: string; solicitacoes: number; publicacoes: number; pendencias: number | string; negados: number }[], filtros: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Participacao por sargento");
  cabecalho(ws, ["Solicitante", "Solicitações", "Publicações", "Pendências", "Negados"]);
  for (const l of linhas) ws.addRow([seguro(l.sargento), l.solicitacoes, l.publicacoes, l.pendencias, l.negados]);
  meta(ws, filtros, new Date());
  return Buffer.from(await wb.xlsx.writeBuffer());
}
