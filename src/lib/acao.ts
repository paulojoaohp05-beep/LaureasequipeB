// Contrato de retorno das Server Actions de mutação chamadas por clientes.
// Em produção, o Next oculta a mensagem de erros lançados ("Minified React error"),
// então mutações retornam Resultado em vez de lançar.
import { ErroPermissao, ErroValidacao } from "@/lib/elogios";

export type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: string };

export async function executar<T>(fn: () => Promise<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, dados: await fn() };
  } catch (e) {
    if (e instanceof ErroValidacao || e instanceof ErroPermissao) return { ok: false, erro: e.message };
    console.error(e);
    return { ok: false, erro: "Erro inesperado no servidor. Tente novamente; se persistir, contate o administrador." };
  }
}

export function desembrulhar<T>(r: Resultado<T>): T {
  if (!r.ok) throw new Error(r.erro);
  return r.dados;
}
