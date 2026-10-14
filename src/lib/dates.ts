// Contrato de data civil: strings "AAAA-MM-DD" para datas de negócio,
// exibição "dd/MM/aaaa". Timestamps de auditoria são ISO do servidor.
const TZ = "America/Sao_Paulo";

export function hojeSP(): string {
  // Data civil atual em São Paulo
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function isDataCivil(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [a, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function formatBR(data?: string): string {
  if (!data || !isDataCivil(data)) return "—";
  const [a, m, d] = data.split("-");
  return `${d}/${m}/${a}`;
}

export function parseBR(data: string): string | undefined {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data.trim());
  if (!m) return undefined;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return isDataCivil(iso) ? iso : undefined;
}

export function periodoBounds(tipo: "mes-atual" | "ultimos-6" | "ultimos-12" | "personalizado", de?: string, ate?: string): { de: string; ate: string } {
  const hoje = hojeSP();
  const [y, mo] = hoje.split("-").map(Number);
  const d = (yy: number, mm: number) => new Date(Date.UTC(yy, mm - 1, 1));
  const addMeses = (yy: number, mm: number, n: number) => { const t = d(yy, mm); t.setUTCMonth(t.getUTCMonth() + n); return t; };
  const fimMes = (yy: number, mm: number) => { const t = addMeses(yy, mm, 1); t.setUTCDate(0); return t; };
  const iso = (dt: Date) => dt.toISOString().slice(0, 10);
  switch (tipo) {
    case "mes-atual": return { de: iso(d(y, mo)), ate: iso(fimMes(y, mo)) };
    case "ultimos-6": { const ini = addMeses(y, mo, -5); return { de: iso(ini), ate: iso(fimMes(y, mo)) }; }
    case "ultimos-12": { const ini = addMeses(y, mo, -11); return { de: iso(ini), ate: iso(fimMes(y, mo)) }; }
    case "personalizado": {
      const r = { de: de && isDataCivil(de) ? de : "0000-01-01", ate: ate && isDataCivil(ate) ? ate : "9999-12-31" };
      return r.de <= r.ate ? r : { de: r.ate, ate: r.de };
    }
  }
}

export function dentroPeriodo(data: string | undefined, de: string, ate: string): boolean | null {
  if (!data) return null; // sem data → pendente, não conta como fora/dentro
  return data >= de && data <= ate;
}

export function anosEntre(data: string, ref?: string): number {
  const a = new Date(data + "T12:00:00Z"), b = new Date((ref ?? hojeSP()) + "T12:00:00Z");
  let anos = b.getUTCFullYear() - a.getUTCFullYear();
  if (b.getUTCMonth() < a.getUTCMonth() || (b.getUTCMonth() === a.getUTCMonth() && b.getUTCDate() < a.getUTCDate())) anos--;
  return Math.max(0, anos);
}
