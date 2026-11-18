"use client";

export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-center">
      <h2 className="font-semibold text-[#1f3a5f] dark:text-[#8fb3e6]">Algo deu errado</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Ocorreu um erro inesperado ao carregar esta página.</p>
      <button onClick={() => retry()} className="mt-4 rounded bg-[#1f3a5f] dark:bg-[#2e5283] px-4 py-1.5 text-sm text-white">Tentar novamente</button>
    </div>
  );
}
