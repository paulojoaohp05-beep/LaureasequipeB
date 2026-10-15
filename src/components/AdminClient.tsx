"use client";
import { useState, useTransition } from "react";
import { definirUsuario, importarPlanilha } from "@/server/actions";
import type { Integrante, UsuarioModulo } from "@/lib/types";

export function AdminClient({ usuarios, integrantes }: { usuarios: UsuarioModulo[]; integrantes: Integrante[] }) {
  const [aba, setAba] = useState<"usuarios" | "importacao">("usuarios");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-[#1f3a5f] dark:text-[#8fb3e6]">Administração</h1>
      <div className="flex gap-2">
        {(["usuarios", "importacao"] as const).map(a => (
          <button key={a} onClick={() => setAba(a)} className={`rounded px-4 py-1.5 text-sm ${aba === a ? "bg-[#1f3a5f] dark:bg-[#2e5283] text-white" : "border border-slate-300 dark:border-slate-600"}`}>
            {a === "usuarios" ? "Acessos" : "Importação de efetivo"}
          </button>
        ))}
      </div>
      {aba === "usuarios" ? <Usuarios usuarios={usuarios} integrantes={integrantes} /> : <Importacao />}
    </div>
  );
}

function Usuarios({ usuarios, integrantes }: { usuarios: UsuarioModulo[]; integrantes: Integrante[] }) {
  const [erro, setErro] = useState("");
  const [pending, start] = useTransition();
  const nomes = new Map(integrantes.map(i => [i.id, i.nomeGuerra || i.nome]));

  function salvar(fd: FormData) {
    setErro("");
    start(async () => {
      try {
        await definirUsuario(String(fd.get("uid")), {
          perfil: fd.get("perfil") as "admin" | "gestor" | "editor" | "visualizador",
          ativo: fd.get("ativo") === "on",
          integranteId: String(fd.get("integrante") ?? "") || undefined,
        });
      } catch (e) { setErro(e instanceof Error ? e.message : "Erro"); }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {erro && <p role="alert" className="rounded border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-400">{erro}</p>}
      <p className="text-xs text-slate-500 dark:text-slate-400">Informe o UID do Firebase Authentication do usuário. O vínculo com integrante é confirmado manualmente — nunca deduzido por e-mail ou nome.</p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <table className="mobile-cards w-full min-w-[680px] text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-left text-slate-600 dark:text-slate-400"><tr><th className="px-3 py-2">UID / e-mail</th><th className="px-3 py-2">Integrante vinculado</th><th className="px-3 py-2">Perfil</th><th className="px-3 py-2">Ativo</th><th className="px-3 py-2"></th></tr></thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.uid} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-2"><span className="font-mono text-xs">{u.uid}</span><br />{u.email}</td>
                <td className="px-3 py-2">{u.integranteId ? nomes.get(u.integranteId) ?? u.integranteId : "—"}</td>
                <td className="px-3 py-2">{u.perfil}</td>
                <td className="px-3 py-2">{u.ativo ? "sim" : "não"}</td>
                <td className="px-3 py-2"><Detalhes u={u} integrantes={integrantes} onSalvar={salvar} pending={pending} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form action={salvar} className="grid gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 md:grid-cols-5">
        <label className="text-sm md:col-span-2">UID do usuário
          <input name="uid" required className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5 font-mono text-xs" placeholder="Firebase UID" />
        </label>
        <label className="text-sm">Integrante
          <select name="integrante" className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5">
            <option value="">—</option>
            {integrantes.map(i => <option key={i.id} value={i.id}>{i.graduacao} {i.nomeGuerra || i.nome}</option>)}
          </select>
        </label>
        <label className="text-sm">Perfil
          <select name="perfil" className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 px-2 py-1.5">
            <option value="visualizador">Visualização</option><option value="editor">Sargento/editor</option><option value="gestor">Gestor (tudo exceto Administração)</option><option value="admin">Administrador</option>
          </select>
        </label>
        <div className="flex items-end gap-2 pb-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="ativo" defaultChecked /> Ativo</label>
          <button disabled={pending} className="rounded bg-[#1f3a5f] dark:bg-[#2e5283] px-4 py-1.5 text-sm text-white">Salvar</button>
        </div>
      </form>
    </div>
  );
}

function Detalhes({ u, integrantes, onSalvar, pending }: { u: UsuarioModulo; integrantes: Integrante[]; onSalvar: (fd: FormData) => void; pending: boolean }) {
  return (
    <form action={onSalvar} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="uid" value={u.uid} />
      <input type="hidden" name="integrante" value={u.integranteId ?? ""} />
      <select name="perfil" defaultValue={u.perfil} className="rounded border border-slate-300 dark:border-slate-600 px-1 py-0.5 text-xs">
        <option value="visualizador">visualizador</option><option value="editor">editor</option><option value="gestor">gestor</option><option value="admin">admin</option>
      </select>
      <label className="text-xs"><input type="checkbox" name="ativo" defaultChecked={u.ativo} /> ativo</label>
      <button disabled={pending} className="text-xs text-[#1f3a5f] dark:text-[#8fb3e6] underline">atualizar</button>
    </form>
  );
}

function Importacao() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [criar, setCriar] = useState(false);
  const [rel, setRel] = useState<Record<string, unknown> | null>(null);
  const [erro, setErro] = useState("");
  const [pending, start] = useTransition();

  async function enviar(modo: "simulacao" | "gravacao") {
    if (!arquivo) { setErro("Selecione a planilha .xlsx"); return; }
    setErro("");
    const b64 = Buffer.from(await arquivo.arrayBuffer()).toString("base64");
    start(async () => {
      try {
        const r = await importarPlanilha(b64, arquivo.name, modo, { criarNaoEncontrados: criar });
        setRel(r as Record<string, unknown>);
      } catch (e) { setErro(e instanceof Error ? e.message : "Erro na importação"); }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <label className="text-sm">Planilha de efetivo (.xlsx)
          <input type="file" accept=".xlsx" onChange={e => setArquivo(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm" />
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={criar} onChange={e => setCriar(e.target.checked)} /> Criar integrantes não encontrados (após revisão)
        </label>
        <div className="mt-3 flex gap-2">
          <button onClick={() => enviar("simulacao")} disabled={pending} className="rounded border border-[#1f3a5f] dark:border-[#8fb3e6] px-4 py-1.5 text-sm text-[#1f3a5f] dark:text-[#8fb3e6]">Simular (sem gravar)</button>
          <button onClick={() => enviar("gravacao")} disabled={pending || !criar} className="rounded bg-[#1f3a5f] dark:bg-[#2e5283] px-4 py-1.5 text-sm text-white disabled:opacity-50">Executar importação</button>
        </div>
        {erro && <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">{erro}</p>}
      </div>
      {rel && (
        <pre className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-xs">{JSON.stringify(rel, null, 2)}</pre>
      )}
    </div>
  );
}
