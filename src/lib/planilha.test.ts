import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { lerPlanilha, reconciliar, normalizarRE } from "./planilha";
import type { Integrante } from "./types";

function planilhaDeTeste(): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Efetivo - Equipe "B"'],
    [],
    ["POST/GRAD", null, "RE", "NOME", "FUNÇÃO"],
    [],
    [1, "CB PM", "123456-7", "JOAO SILVA", "MOTORISTA"],
    [null, "SD PM", "654321-0-A", "MARIA SOUZA", "AUXILIAR"], // ordem vazia (como A13)
    [3, "1º SGT PM", " 111222-3 ", "PEDRO RAMOS", "CH EQUIPE"],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "EFETIVO-2026");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

describe("lerPlanilha", () => {
  it("lê linhas cadastrais preservando RE como texto, incluindo sufixo -A e ordem vazia", () => {
    const r = lerPlanilha(planilhaDeTeste());
    expect(r.linhas).toHaveLength(3);
    expect(r.linhas[0].re).toBe("123456-7");
    expect(r.linhas[1].re).toBe("654321-0-A");
    expect(r.linhas[1].nome).toBe("MARIA SOUZA");
    expect(r.linhas[2].re).toBe("111222-3"); // espaços externos removidos
    expect(r.porGraduacao["CB PM"]).toBe(1);
  });
});

describe("normalizarRE", () => {
  it("preserva zeros à esquerda, hífen e sufixo", () => {
    expect(normalizarRE("00123-4-A")).toBe("00123-4-A");
    expect(normalizarRE(" 9-9 ")).toBe("9-9");
    expect(normalizarRE(null)).toBeUndefined();
  });
});

describe("reconciliar", () => {
  const cadastro: Integrante[] = [
    { id: "a", graduacao: "CB PM", re: "123456-7", nome: "JOAO SILVA", funcao: "MOTORISTA" },
    { id: "b", graduacao: "SD PM", re: "654321-0-A", nome: "MARIA SOUZA", funcao: "" },
    { id: "c1", graduacao: "1º SGT PM", re: "111222-3", nome: "PEDRO RAMOS" },
    { id: "c2", graduacao: "1º SGT PM", re: "111222-3", nome: "PEDRO R." },
  ];

  it("classifica inalterado, complemento, não-encontrado e ambíguas", () => {
    const linhas = [
      { linha: 5, graduacao: "CB PM", re: "123456-7", nome: "JOAO SILVA", funcao: "MOTORISTA" },
      { linha: 6, graduacao: "SD PM", re: "654321-0-A", nome: "MARIA SOUZA", funcao: "AUXILIAR" }, // função vazia → complemento
      { linha: 7, graduacao: "1º SGT PM", re: "111222-3", nome: "PEDRO RAMOS", funcao: "CH EQUIPE" }, // ambíguo
      { linha: 8, graduacao: "CB PM", re: "999999-9", nome: "NOVO", funcao: "" }, // não encontrado
    ];
    const { resultados, resumo } = reconciliar(linhas, cadastro);
    expect(resultados[0].tipo).toBe("inalterado");
    expect(resultados[1].tipo).toBe("complemento");
    expect(resultados[2].tipo).toBe("ambiguas");
    expect(resultados[3].tipo).toBe("nao-encontrado");
    expect(resumo).toMatchObject({ existentes: 1, complementos: 1, ambiguos: 1, naoEncontrados: 1 });
  });

  it("divergência de nome não é resolvida silenciosamente", () => {
    const { resultados } = reconciliar([{ linha: 1, graduacao: "CB PM", re: "123456-7", nome: "JOÃO SILVA JR", funcao: "MOTORISTA" }], cadastro.slice(0, 1));
    expect(resultados[0].tipo).toBe("divergente");
  });
});
