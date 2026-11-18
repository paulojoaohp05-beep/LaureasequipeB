import { describe, expect, it } from "vitest";
import { Firestore } from "@google-cloud/firestore";
import { montarAtualizacaoComplemento } from "./efetivo";
import { calcularMedalha } from "./medalha";
import { ErroValidacao } from "./elogios";

const HOJE = "2026-11-18";

function semUndefined(v: unknown): boolean {
  if (v === undefined) return false;
  if (Array.isArray(v)) return v.every(semUndefined);
  if (v !== null && typeof v === "object") return Object.values(v).every(semUndefined);
  return true;
}

describe("montarAtualizacaoComplemento", () => {
  it("cenário Vanessa: formulário completo sem mudanças reais → campos vazio, sem undefined", () => {
    const compAntes = { integranteId: "x1", schemaVersion: 1, cnh: "B", sat: "B" };
    const { upd, campos } = montarAtualizacaoComplemento({
      nomeGuerra: "", ingressoEquipe: "", ingressoPM: "", situacaoEquipe: "ativo",
      cnh: "B", sat: "B", medalhaRecebida: "", medalhaRecebidaEm: "",
    }, compAntes, HOJE);
    expect(campos).toEqual({});
    expect(semUndefined(upd)).toBe(true);
    expect(semUndefined(campos)).toBe(true);
  });

  it("situacaoEquipe ativa implícita não vira auditoria; mudança real registra sem `antes` ausente", () => {
    const r = montarAtualizacaoComplemento({ situacaoEquipe: "afastado" }, {}, HOJE);
    expect(r.upd.situacaoEquipe).toBe("afastado");
    expect(r.campos.situacaoEquipe).toEqual({ depois: "afastado" });
  });

  it("define e limpa medalha; limpar grau limpa a data", () => {
    const r = montarAtualizacaoComplemento({ ingressoPM: "2000-01-01", medalhaRecebida: "prata", medalhaRecebidaEm: "2020-02-01" }, {}, HOJE);
    expect(r.upd.medalhaRecebida).toBe("prata");
    expect(r.upd.medalhaRecebidaEm).toBe("2020-02-01");
    const r2 = montarAtualizacaoComplemento({ medalhaRecebida: "" }, { ...r.upd }, HOJE);
    expect(r2.upd.medalhaRecebida).toBe("");
    expect(r2.upd.medalhaRecebidaEm).toBe("");
  });

  it("data do recebimento exige grau", () => {
    expect(() => montarAtualizacaoComplemento({ medalhaRecebidaEm: "2020-02-01" }, {}, HOJE)).toThrow(ErroValidacao);
    expect(() => montarAtualizacaoComplemento({ medalhaRecebidaEm: "2020-02-01" }, { medalhaRecebida: "bronze" }, HOJE)).not.toThrow();
  });

  it("rejeita data de recebimento anterior ao ingresso na PM", () => {
    expect(() => montarAtualizacaoComplemento({ medalhaRecebida: "bronze", medalhaRecebidaEm: "1999-01-01" }, { ingressoPM: "2000-01-01" }, HOJE)).toThrow(ErroValidacao);
  });

  it("rejeita datas futuras e situação inválida", () => {
    expect(() => montarAtualizacaoComplemento({ ingressoPM: "2099-01-01" }, {}, HOJE)).toThrow(ErroValidacao);
    expect(() => montarAtualizacaoComplemento({ medalhaRecebidaEm: "2099-01-01" }, { medalhaRecebida: "ouro" }, HOJE)).toThrow(ErroValidacao);
    expect(() => montarAtualizacaoComplemento({ situacaoEquipe: "excluido" }, {}, HOJE)).toThrow(ErroValidacao);
    expect(() => montarAtualizacaoComplemento({ situacaoEquipe: "qualquer" }, {}, HOJE)).toThrow(ErroValidacao);
  });

  it("pendentes refletem os valores finais", () => {
    expect(montarAtualizacaoComplemento({}, {}, HOJE).pendentes).toEqual(["ingressoEquipe", "ingressoPM"]);
    expect(montarAtualizacaoComplemento({ ingressoPM: "2000-01-01" }, { ingressoEquipe: "2010-01-01" }, HOJE).pendentes).toEqual([]);
  });

  it("round-trip: merge do upd no compAntes alimenta calcularMedalha", () => {
    const compAntes = { integranteId: "x1", schemaVersion: 1 };
    const { upd } = montarAtualizacaoComplemento({ ingressoPM: "2006-11-18", medalhaRecebida: "prata" }, compAntes, HOJE);
    const compFinal: Record<string, unknown> = { ...compAntes, ...upd };
    const m = calcularMedalha(compFinal.ingressoPM as string, compFinal.medalhaRecebida, compFinal.medalhaRecebidaEm as string | undefined, HOJE);
    expect(m.tempo).toEqual({ anos: 20, meses: 0, dias: 0 });
    expect(m.situacao).toBe("em-dia");
    expect(m.proxima).toEqual({ grau: "ouro", data: "2036-11-18" });
  });
});

describe("serialização Firestore (sem rede)", () => {
  it("com ignoreUndefinedProperties, merge/create aceitam upd e campos sem lançar", () => {
    const db = new Firestore({ projectId: "demo-test", ignoreUndefinedProperties: true });
    const { upd, campos } = montarAtualizacaoComplemento({ situacaoEquipe: "ativo", cnh: "B" }, { integranteId: "x", schemaVersion: 1 }, HOJE);
    const batch = db.batch();
    batch.set(db.collection("efetivoComplementos").doc("x"), { ...upd, camposPendentes: ["ingressoPM"] }, { merge: true });
    batch.create(db.collection("auditoria").doc("a"), { campos });
    // nunca commit() — apenas validação local do serializador
  });
  it("sem a setting, `antes: undefined` derruba a escrita (causa raiz do bug)", () => {
    const db = new Firestore({ projectId: "demo-test" });
    expect(() => db.batch().create(db.collection("auditoria").doc("a"), { campos: { x: { antes: undefined, depois: "ativo" } } }))
      .toThrow(/undefined/);
  });
});
