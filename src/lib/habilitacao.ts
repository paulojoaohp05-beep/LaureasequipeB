/** Categorias são livres (não há enum); vazio também permite remoção na edição manual. */
export function normalizarCategoria(valor: unknown): string {
  const categoria = String(valor ?? "").trim().toUpperCase().replace(/\//g, "");
  return categoria === "***" ? "" : categoria;
}

export function normalizarSat(valor: unknown): string {
  return String(valor ?? "").trim() === "***" ? "NÃO POSSUI" : normalizarCategoria(valor);
}
