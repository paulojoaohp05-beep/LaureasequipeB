import { describe, expect, it } from "vitest";
import { calcularMedalha, somarPrazo, tempoDeServico } from "./medalha";

describe("somarPrazo", () => {
  it("expira no dia de igual número (CC art. 132 §3º)", () => {
    expect(somarPrazo("2016-11-18", 10)).toBe("2026-11-18");
    expect(somarPrazo("2000-05-10", 20)).toBe("2020-05-10");
  });
  it("dia inexistente no mês alvo cai no dia seguinte", () => {
    expect(somarPrazo("2016-02-29", 10)).toBe("2026-03-01"); // 2026 não é bissexto
    expect(somarPrazo("2020-01-31", 0, 1)).toBe("2020-03-01"); // fev não tem 31
    expect(somarPrazo("2020-02-29", 4)).toBe("2024-02-29"); // bissexto preserva
  });
});

describe("tempoDeServico", () => {
  it("null para ingresso inválido ou futuro", () => {
    expect(tempoDeServico("18/11/2016", "2026-11-18")).toBeNull();
    expect(tempoDeServico("2027-01-01", "2026-11-18")).toBeNull();
    expect(tempoDeServico("2026-11-18", "2026-11-18")).toEqual({ anos: 0, meses: 0, dias: 0 });
  });
  it("fronteiras: véspera e dia exato dos 10 anos", () => {
    expect(tempoDeServico("2016-11-18", "2026-11-17")).toEqual({ anos: 9, meses: 11, dias: 30 });
    expect(tempoDeServico("2016-11-18", "2026-11-18")).toEqual({ anos: 10, meses: 0, dias: 0 });
  });
  it("29/02: ref 2026-02-28 ainda não completa 10 anos; 2026-03-01 completa", () => {
    expect(tempoDeServico("2016-02-29", "2026-02-28")!.anos).toBe(9);
    expect(tempoDeServico("2016-02-29", "2026-03-01")).toEqual({ anos: 10, meses: 0, dias: 0 });
  });
  it("fim de mês: 31/01 + 1 mês = 01/03", () => {
    expect(tempoDeServico("2020-01-31", "2020-03-01")).toEqual({ anos: 0, meses: 1, dias: 0 });
  });
  it("decomposição anos/meses/dias", () => {
    expect(tempoDeServico("2000-05-10", "2026-11-18")).toEqual({ anos: 26, meses: 6, dias: 8 });
  });
});

describe("calcularMedalha", () => {
  it("devida por faixa e transição automática com a referência", () => {
    const i = "2000-05-10";
    expect(calcularMedalha(i, undefined, undefined, "2010-05-09").devida).toBeNull();
    expect(calcularMedalha(i, undefined, undefined, "2010-05-10").devida).toBe("bronze");
    expect(calcularMedalha(i, undefined, undefined, "2020-05-10").devida).toBe("prata");
    expect(calcularMedalha(i, undefined, undefined, "2030-05-10").devida).toBe("ouro");
  });
  it("proxima graduação indica grau e data", () => {
    const m = calcularMedalha("2016-11-18", undefined, undefined, "2026-11-18");
    expect(m.proxima).toEqual({ grau: "prata", data: "2036-11-18" });
    expect(calcularMedalha("1990-01-01", "ouro", undefined, "2030-01-01").proxima).toBeNull();
    expect(calcularMedalha(undefined, undefined, undefined, "2026-11-18").proxima).toBeNull();
  });
  it("situacao sem-data: ausente, inválida ou futura", () => {
    for (const ing of [undefined, "10/05/2000", "2999-01-01"]) {
      expect(calcularMedalha(ing, undefined, undefined, "2026-11-18").situacao).toBe("sem-data");
    }
  });
  it("situacao nao-faz-jus / pendente / pendente-superior / em-dia", () => {
    expect(calcularMedalha("2020-01-01", undefined, undefined, "2026-11-18").situacao).toBe("nao-faz-jus");
    expect(calcularMedalha("2010-01-01", undefined, undefined, "2026-11-18").situacao).toBe("pendente");
    expect(calcularMedalha("2000-01-01", "bronze", undefined, "2026-11-18").situacao).toBe("pendente-superior");
    expect(calcularMedalha("2000-01-01", "prata", "2020-03-05", "2026-11-18").situacao).toBe("em-dia");
  });
  it("situacao verificar: recebida acima do tempo calculado (inclusive sem devida)", () => {
    expect(calcularMedalha("2010-01-01", "ouro", undefined, "2026-11-18").situacao).toBe("verificar");
    expect(calcularMedalha("2020-01-01", "bronze", undefined, "2026-11-18").situacao).toBe("verificar");
  });
  it("grau desconhecido normaliza para null", () => {
    const m = calcularMedalha("2000-01-01", "diamante", undefined, "2026-11-18");
    expect(m.recebida).toBeNull();
    expect(m.situacao).toBe("pendente");
  });
});
