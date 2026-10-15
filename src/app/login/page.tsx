"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getClientAuth } from "@/lib/firebase/client";
import { signInWithEmailAndPassword, sendPasswordResetEmail, signInWithPopup, GoogleAuthProvider, type UserCredential } from "firebase/auth";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState("");
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  async function criarSessao(cred: UserCredential) {
    const res = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: await cred.user.getIdToken() }) });
    if (!res.ok) throw new Error();
    router.push("/");
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true); setMsg("");
    try {
      await criarSessao(await signInWithEmailAndPassword(getClientAuth(), email.trim(), senha));
    } catch {
      setMsg("E-mail ou senha inválidos, ou acesso ainda não autorizado.");
    } finally { setCarregando(false); }
  }

  async function entrarGoogle() {
    setCarregando(true); setMsg("");
    try {
      await criarSessao(await signInWithPopup(getClientAuth(), new GoogleAuthProvider()));
    } catch {
      setMsg("Falha no login com Google, ou acesso ainda não autorizado.");
    } finally { setCarregando(false); }
  }

  async function recuperar() {
    if (!email.trim()) { setMsg("Informe o e-mail para recuperar a senha."); return; }
    await sendPasswordResetEmail(getClientAuth(), email.trim()).catch(() => {});
    setMsg("Se o e-mail estiver cadastrado, você receberá as instruções.");
  }

  return (
    <div className="relative mx-auto mt-6 w-full max-w-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm  dark:bg-slate-900 sm:mt-16 sm:p-6">
      <div className="absolute right-2 top-2"><ThemeToggle /></div>
      <h1 className="mb-1 text-lg font-semibold text-[#1f3a5f] dark:text-[#8fb3e6]">Controle de Láureas — Equipe B</h1>
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">Acesso restrito a usuários autorizados.</p>

      <button onClick={entrarGoogle} disabled={carregando}
        className="mb-4 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60">
        Entrar com Google
      </button>

      <div className="mb-4 flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
        <hr className="flex-1 border-slate-200 dark:border-slate-700" /> ou <hr className="flex-1 border-slate-200 dark:border-slate-700" />
      </div>

      <form onSubmit={entrar} className="flex flex-col gap-3">
        <label className="text-sm">E-mail
          <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 px-3 py-2" />
        </label>
        <label className="text-sm">Senha
          <input type="password" required autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 px-3 py-2" />
        </label>
        {msg && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{msg}</p>}
        <button disabled={carregando} className="rounded bg-[#1f3a5f] dark:bg-[#2e5283] px-4 py-2 font-medium text-white disabled:opacity-60">
          {carregando ? "Entrando…" : "Entrar"}
        </button>
        <button type="button" onClick={recuperar} className="text-sm text-[#1f3a5f] dark:text-[#8fb3e6] underline">Esqueci a senha</button>
      </form>
    </div>
  );
}
