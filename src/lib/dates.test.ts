import { describe, it, expect } from "vitest";
import { formatBR, parseBR, isDataCivil, periodoBounds, dentroPeriodo } from "./dates";

describe("datas civis", () => {
  it("formata dd/MM/aaaa e valida AAAA-MM-DD", () => {
    expect(formatBR("2026-10-14")).toBe("14/10/2026");
    expect(formatBR(undefined)).toBe("—");
    expect(formatBR("lixo")).toBe("—");
    expect(isDataCivil("2026-02-30")).toBe(false);
    expect(parseBR("14/10/2026")).toBe("2026-10-14");
    expect(parseBR("2026-10-14")).toBeUndefined();
  });

  it("períodos cobrem limites de mês", () => {
    const m = periodoBounds("mes-atual");
    expect(m.de.endsWith("-01")).toBe(true);
    expect(m.de <= m.ate).toBe(true);
  });

  it("dentroPeriodo retorna null para data ausente (pendente)", () => {
    expect(dentroPeriodo(undefined, "2026-01-01", "2026-12-31")).toBeNull();
    expect(dentroPeriodo("2026-06-15", "2026-01-01", "2026-12-31")).toBe(true);
    expect(dentroPeriodo("2025-06-15", "2026-01-01", "2026-12-31")).toBe(false);
  });
});
