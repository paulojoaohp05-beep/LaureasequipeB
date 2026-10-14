import { describe, it, expect } from "vitest";
import { podeTransitar, assertPodeEditar, assertPodePublicarOuCancelar, assertPublicacaoCompleta, assertSolicitante, ErroPermissao, ErroValidacao } from "./elogios";
import type { Elogio } from "./types";

const base: Elogio = {
  id: "e1", equipeId: "equipe-b", destinatarioIds: ["a"], solicitanteId: "s1",
  lancadoPorUid: "u1", titulo: "t", dataSolicitacao: "2026-10-01", situacao: "solicitado",
};

describe("transições", () => {
  it("solicitado → publicado/cancelado; publicado é terminal", () => {
    expect(podeTransitar("solicitado", "publicado")).toBe(true);
    expect(podeTransitar("solicitado", "negado")).toBe(true);
    expect(podeTransitar("solicitado", "cancelado")).toBe(true);
    expect(podeTransitar("negado", "publicado")).toBe(false);
    expect(podeTransitar("publicado", "cancelado")).toBe(false);
    expect(podeTransitar("cancelado", "solicitado")).toBe(false);
  });
});

describe("permissões de edição", () => {
  it("editor edita apenas os próprios registros não publicados", () => {
    expect(() => assertPodeEditar(base, "editor", "u1")).not.toThrow();
    expect(() => assertPodeEditar(base, "editor", "outro")).toThrow(ErroPermissao);
    expect(() => assertPodeEditar({ ...base, situacao: "publicado" }, "editor", "u1")).toThrow(ErroPermissao);
    expect(() => assertPodeEditar(base, "visualizador", "u1")).toThrow(ErroPermissao);
    expect(() => assertPodeEditar(base, "admin", "qualquer")).not.toThrow();
  });
  it("gestor edita registro de outro uid não publicado; publicado/negado são fechados", () => {
    expect(() => assertPodeEditar(base, "gestor", "outro")).not.toThrow();
    expect(() => assertPodeEditar({ ...base, situacao: "publicado" }, "gestor", "u1")).toThrow(ErroPermissao);
    expect(() => assertPodeEditar({ ...base, situacao: "negado" }, "gestor", "u1")).toThrow(ErroPermissao);
  });
  it("gestor publica/nega; editor e visualizador não", () => {
    expect(() => assertPodePublicarOuCancelar("gestor")).not.toThrow();
    expect(() => assertPodePublicarOuCancelar("admin")).not.toThrow();
    expect(() => assertPodePublicarOuCancelar("editor")).toThrow(ErroPermissao);
    expect(() => assertPodePublicarOuCancelar("visualizador")).toThrow(ErroPermissao);
  });
});

describe("publicação e solicitante", () => {
  it("exige data e referência", () => {
    expect(() => assertPublicacaoCompleta({})).toThrow(ErroValidacao);
    expect(() => assertPublicacaoCompleta({ dataPublicacao: "2026-10-10" })).toThrow(ErroValidacao);
    expect(() => assertPublicacaoCompleta({ dataPublicacao: "2026-10-10", referencia: "BG 42" })).not.toThrow();
  });
  it("editor só lança em nome próprio; admin pode lançar por outro sargento", () => {
    expect(() => assertSolicitante("editor", "s1", "s1")).not.toThrow();
    expect(() => assertSolicitante("editor", "s2", "s1")).toThrow(ErroPermissao);
    expect(() => assertSolicitante("admin", "s2", undefined)).not.toThrow();
    expect(() => assertSolicitante("visualizador", "s1", "s1")).toThrow(ErroPermissao);
  });
});
