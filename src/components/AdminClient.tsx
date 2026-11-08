"use client";
import { useState, useTransition } from "react";
import { definirUsuario, importarPlanilha, importarHabilitacoes } from "@/server/actions";
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
      {aba === "usuarios" ? <Usuarios usuarios={usuarios} integrantes={integrantes} /> : (
        <div className="flex flex-col gap-6">
          <Importacao />
          <ImportacaoHabilitacoes />
        </div>
      )}
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

type DetalheHab = {
  tipo: string; linha?: number; re?: string; nome?: string; integranteId?: string;
  rePlanilha?: string; reCadastro?: string; campos?: { cnh?: string; sat?: string }; antes?: { cnh: string; sat: string };
  candidatos?: { id: string; re: string; nome: string }[];
};
type RelHab = {
  modo: string; hashPlano: string; lidas: number; exatos: number; atualizar: number; inalterados: number;
  reDivergentes: number; naoEncontrados: number; ambiguos: number; aplicados: number;
  invalidas: { linha: number; motivo: string }[]; detalhes: DetalheHab[];
};

function ImportacaoHabilitacoes() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [rel, setRel] = useState<RelHab | null>(null);
  const [revisado, setRevisado] = useState(false);
  const [erro, setErro] = useState("");
  const [pending, start] = useTransition();

  function enviar(modo: "simulacao" | "gravacao") {
    if (!arquivo) { setErro("Selecione a planilha .xlsx"); return; }
    if (modo === "gravacao" && (!revisado || rel?.modo !== "simulacao")) return;
    setErro("");
    setRevisado(false);
    start(async () => {
      try {
        if (arquivo.size > 5 * 1024 * 1024) throw new Error("Arquivo muito grande (máx. 5 MB)");
        const bytes = new Uint8Array(await arquivo.arrayBuffer());
        let binario = "";
        for (let i = 0; i < bytes.length; i += 8192) binario += String.fromCharCode(...bytes.subarray(i, i + 8192));
        const r = await importarHabilitacoes(btoa(binario), arquivo.name, modo, modo === "gravacao" ? rel?.hashPlano : undefined);
        setRel(r);
      } catch (e) { setRel(null); setErro(e instanceof Error ? e.message : "Erro na importação"); }
    });
  }

  const divergentes = rel?.detalhes.filter(d => d.tipo === "re-divergente") ?? [];
  const naoEncontrados = rel?.detalhes.filter(d => d.tipo === "nao-encontrado") ?? [];
  const ambiguos = rel?.detalhes.filter(d => d.tipo === "ambiguo") ?? [];

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-semibold text-[#1f3a5f] dark:text-[#8fb3e6]">Importar CNH e SAT</h2>
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">Planilha de antiguidade (.xlsx, aba ANTIGUIDADE). Vínculo por RE-base + primeiro nome, tolerando dígito divergente; nunca apenas por nome completo. A/B = AB; *** = não possui SAT. Célula vazia não apaga o cadastro.</p>
        <label className="mt-2 block text-sm">Planilha de habilitações (.xlsx)
          <input type="file" accept=".xlsx" disabled={pending} onChange={e => { setArquivo(e.target.files?.[0] ?? null); setRel(null); setRevisado(false); setErro(""); }} className="mt-1 block w-full text-sm" />
        </label>
        <div className="mt-3 flex gap-2">
          <button onClick={() => enviar("simulacao")} disabled={pending} className="rounded border border-[#1f3a5f] dark:border-[#8fb3e6] px-4 py-1.5 text-sm text-[#1f3a5f] dark:text-[#8fb3e6]">Simular (sem gravar)</button>
          <button onClick={() => enviar("gravacao")} disabled={pending || !revisado || !rel || rel.modo !== "simulacao" || !rel.atualizar} className="rounded bg-[#1f3a5f] dark:bg-[#2e5283] px-4 py-1.5 text-sm text-white disabled:opacity-50">Aplicar</button>
        </div>
        {erro && <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">{erro}</p>}
      </div>
      {rel && (
        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-sm">
          <p>
            {rel.lidas} linha(s) lidas — {rel.exatos} exata(s), {rel.atualizar} a atualizar, {rel.inalterados} inalterada(s)
            {rel.modo === "gravacao" && <> — <strong>{rel.aplicados} aplicada(s)</strong></>}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead><tr><th className="p-2">Linha / Nome</th><th className="p-2">RE planilha → cadastro</th><th className="p-2">CNH antes → depois</th><th className="p-2">SAT antes → depois</th></tr></thead>
              <tbody>{rel.detalhes.filter(d => d.campos && Object.keys(d.campos).length > 0).map((d, i) => (
                <tr key={i} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="p-2">{d.linha}: {d.nome}</td><td className="p-2">{d.rePlanilha} → {d.reCadastro}</td>
                  <td className="p-2">{d.campos?.cnh !== undefined ? `${d.antes?.cnh || "sem informação"} → ${d.campos.cnh}` : "sem alteração"}</td>
                  <td className="p-2">{d.campos?.sat !== undefined ? `${d.antes?.sat || "sem informação"} → ${d.campos.sat}` : "sem alteração"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {rel.modo === "simulacao" && <label className="flex items-center gap-2">
            <input type="checkbox" checked={revisado} disabled={pending} onChange={e => setRevisado(e.target.checked)} /> Revisei as alterações e os dígitos divergentes desta simulação.
          </label>}
          {divergentes.length > 0 && (
            <div>
              <h3 className="font-medium text-amber-700 dark:text-amber-400">RE divergente ({divergentes.length})</h3>
              <ul className="mt-1 list-inside list-disc text-xs text-slate-600 dark:text-slate-400">
                {divergentes.map((d, i) => <li key={i}>{d.nome}: RE planilha {d.rePlanilha} → RE cadastro {d.reCadastro}</li>)}
              </ul>
            </div>
          )}
          {naoEncontrados.length > 0 && (
            <div>
              <h3 className="font-medium text-red-700 dark:text-red-400">Não encontrados ({naoEncontrados.length})</h3>
              <ul className="mt-1 list-inside list-disc text-xs text-slate-600 dark:text-slate-400">
                {naoEncontrados.map((d, i) => <li key={i}>{d.nome} ({d.re})</li>)}
              </ul>
            </div>
          )}
          {ambiguos.length > 0 && (
            <div>
              <h3 className="font-medium text-amber-700 dark:text-amber-400">Ambíguos ({ambiguos.length})</h3>
              <ul className="mt-1 list-inside list-disc text-xs text-slate-600 dark:text-slate-400">
                {ambiguos.map((d, i) => <li key={i}>{d.nome} ({d.re}) — candidatos: {d.candidatos?.map(c => `${c.nome} [${c.re}]`).join(", ")}</li>)}
              </ul>
            </div>
          )}
          {rel.invalidas.length > 0 && (
            <div>
              <h3 className="font-medium text-slate-600 dark:text-slate-400">Linhas inválidas ({rel.invalidas.length})</h3>
              <ul className="mt-1 list-inside list-disc text-xs text-slate-500 dark:text-slate-500">
                {rel.invalidas.map((d, i) => <li key={i}>linha {d.linha}: {d.motivo}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
