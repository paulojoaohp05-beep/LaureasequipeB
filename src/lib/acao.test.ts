import { describe, expect, it, vi } from "vitest";
import { desembrulhar, executar } from "./acao";
import { ErroPermissao, ErroValidacao } from "./elogios";

describe("executar", () => {
  it("sucesso retorna dados", async () => {
    expect(await executar(async () => 42)).toEqual({ ok: true, dados: 42 });
  });
  it("ErroValidacao e ErroPermissao devolvem a mensagem", async () => {
    expect(await executar(async () => { throw new ErroValidacao("Campo inválido"); })).toEqual({ ok: false, erro: "Campo inválido" });
    expect(await executar(async () => { throw new ErroPermissao("Sem permissão"); })).toEqual({ ok: false, erro: "Sem permissão" });
  });
  it("erro desconhecido vira mensagem genérica (não vaza a original)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await executar(async () => { throw new Error("segredo interno"); });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).not.toContain("segredo interno");
    spy.mockRestore();
  });
});

describe("desembrulhar", () => {
  it("retorna dados quando ok", () => {
    expect(desembrulhar({ ok: true, dados: "x" })).toBe("x");
  });
  it("lança Error com a mensagem quando falha", () => {
    expect(() => desembrulhar({ ok: false, erro: "falhou" })).toThrowError("falhou");
  });
});
