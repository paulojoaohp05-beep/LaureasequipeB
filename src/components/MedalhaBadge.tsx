import { ROTULO_SITUACAO } from "@/lib/medalha";
import type { SituacaoMedalha } from "@/lib/medalha";

const CORES: Record<SituacaoMedalha, string> = {
  "em-dia": "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200",
  pendente: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200",
  "pendente-superior": "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200",
  verificar: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300",
  "sem-data": "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400",
  "nao-faz-jus": "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400",
};

export function MedalhaBadge({ situacao }: { situacao: SituacaoMedalha }) {
  return <span className={`rounded px-2 py-0.5 text-xs ${CORES[situacao]}`}>{ROTULO_SITUACAO[situacao]}</span>;
}
