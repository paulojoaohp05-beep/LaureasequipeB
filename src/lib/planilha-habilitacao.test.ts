import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { lerPlanilhaHabilitacoes, reconciliarHabilitacoes, normalizarCategoria, type LinhaHabilitacao } from "./planilha-habilitacao";

function arquivo(rows: unknown[][], aba = "ANTIGUIDADE") {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), aba);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
const headers = ["POST/GRAD", "RE", "DIG", "NOME", "CATEGORIA CNH", "CATEGORIA SAT"];
const linha: LinhaHabilitacao = { linha: 3, graduacao: "CB PM", re: "123-4", nome: "JOÃO SILVA", cnh: "AB", sat: "" };

describe("habilitações", () => {
  it("aceita coluna de ordem sob POST/GRAD mesclado do arquivo real", () => {
    const r = lerPlanilhaHabilitacoes(arquivo([["título"], ["POST/GRAD", null, ...headers.slice(1)],
      [1, "SUBTEN PM", "118687", "5", "JOSÉ", "AB", "B"]]));
    expect(r.linhas[0]).toMatchObject({ graduacao: "SUBTEN PM", re: "118687-5", nome: "JOSÉ", cnh: "AB", sat: "B" });
  });
  it("normaliza categorias livres sem enum restritivo", () => {
    expect(normalizarCategoria(" a/b ")).toBe("AB");
    expect(normalizarCategoria("bd")).toBe("BD");
    expect(normalizarCategoria(" *** ")).toBe("");
    expect(normalizarCategoria(undefined)).toBe("");
    expect(normalizarCategoria("ad/ae")).toBe("ADAE");
  });
  it("lê ANTIGUIDADE, separa RE e dígito inclusive zero e letra", () => {
    const r = lerPlanilhaHabilitacoes(arquivo([["título"], headers,
      ["CB PM", "00123", 0, "JOÃO SILVA", "a/b", "***"],
      ["SD PM", 456, "A", "MARIA", "", "a/b"],
      ["SD PM", null, 1, "SEM RE"]]));
    expect(r.linhas).toHaveLength(2);
    expect(r.linhas[0]).toMatchObject({ re: "00123-0", cnh: "AB", sat: "NÃO POSSUI", linha: 3 });
    expect(r.linhas[1]).toMatchObject({ re: "456-A", cnh: "", sat: "AB" });
    expect(r.invalidas).toHaveLength(1);
  });
  it("recusa aba ou cabeçalho errados", () => {
    expect(() => lerPlanilhaHabilitacoes(arquivo([headers], "OUTRA"))).toThrow("ANTIGUIDADE");
    expect(() => lerPlanilhaHabilitacoes(arquivo([["título"], ["RE"]]))).toThrow("Cabeçalho");
  });
  it("exige primeiro nome mesmo com RE exato", () => {
    const r = reconciliarHabilitacoes([linha], [{ id: "a", re: "123-4", nome: "OUTRO NOME" }]);
    expect(r.resultados[0].tipo).toBe("nao-encontrado");
    expect(r.resumo.exatos).toBe(0);
  });
  it("marca dígito divergente por base + primeiro nome normalizado", () => {
    const r = reconciliarHabilitacoes([linha], [{ id: "a", re: "123-A", nome: " joao OUTRO " }]);
    expect(r.resultados[0]).toMatchObject({ tipo: "re-divergente", campos: { cnh: "AB" } });
    expect(r.resumo.reDivergentes).toBe(1);
  });
  it("não vincula por nome completo quando a base do RE diverge", () => {
    const cadastro = [{ id: "a", re: "999-9", nome: " João   Silva " }, { id: "b", re: "888-8", nome: "JOÃO SILVA" }];
    expect(reconciliarHabilitacoes([linha], cadastro).resultados[0].tipo).toBe("nao-encontrado");
  });
  it("trata *** como ausência explícita de SAT, diferente de célula vazia", () => {
    const leitura = lerPlanilhaHabilitacoes(arquivo([["título"], headers, ["CB PM", "123", "4", "JOÃO SILVA", "a/b", "***"]]));
    expect(leitura.linhas[0].sat).toBe("NÃO POSSUI");
    const r = reconciliarHabilitacoes(leitura.linhas, [{ id: "a", re: "123-4", nome: "JOAO", sat: "D" }]);
    expect(r.resultados[0]).toMatchObject({ campos: { cnh: "AB", sat: "NÃO POSSUI" } });
  });
  it("não favorece RE exato quando a base + primeiro nome tem mais de um candidato", () => {
    const cadastro = [{ id: "a", re: "123-4", nome: "JOÃO SILVA" }, { id: "b", re: "123-9", nome: "JOAO SOUZA" }];
    expect(reconciliarHabilitacoes([linha], cadastro).resultados[0].tipo).toBe("ambiguo");
  });
  it("reconhece ausência de SAT já cadastrada sem gerar nova alteração", () => {
    const r = reconciliarHabilitacoes([{ ...linha, sat: "***" }], [{ id: "a", re: "123-4", nome: "JOÃO", cnh: "AB", sat: "NÃO POSSUI" }]);
    expect(r.resultados[0]).toMatchObject({ tipo: "inalterado", campos: {} });
  });
  it("não encontra base com primeiro nome diferente", () => {
    expect(reconciliarHabilitacoes([linha], [{ id: "a", re: "123-9", nome: "JOSE SILVA" }]).resultados[0].tipo).toBe("nao-encontrado");
  });
  it("rejeita candidatos ambíguos tanto no fallback quanto no exato", () => {
    const cadastro = [{ id: "a", re: "123-9", nome: "JOAO SILVA" }, { id: "b", re: "123-9", nome: "JOAO SOUZA" }];
    expect(reconciliarHabilitacoes([linha], cadastro).resultados[0].tipo).toBe("ambiguo");
    expect(reconciliarHabilitacoes([{ ...linha, re: "123-9" }], cadastro).resultados[0].tipo).toBe("ambiguo");
  });
  it("não limpa valores existentes com células vazias e reconhece inalterados", () => {
    const r = reconciliarHabilitacoes([linha], [{ id: "a", re: "123-4", nome: "JOAO", cnh: "AB", sat: "D" }]);
    expect(r.resultados[0]).toMatchObject({ tipo: "inalterado", campos: {} });
    const vazio = reconciliarHabilitacoes([{ ...linha, cnh: "***" }], [{ id: "a", re: "123-4", nome: "JOAO", cnh: "AE" }]);
    expect(vazio.resultados[0]).toMatchObject({ tipo: "inalterado", campos: {} });
  });
});
