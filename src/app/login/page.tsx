"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getClientAuth } from "@/lib/firebase/client";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState("");
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true); setMsg("");
    try {
      const cred = await signInWithEmailAndPassword(getClientAuth(), email.trim(), senha);
      const res = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: await cred.user.getIdToken() }) });
      if (!res.ok) throw new Error();
      router.push("/");
    } catch {
      setMsg("E-mail ou senha inválidos, ou acesso ainda não autorizado.");
    } finally { setCarregando(false); }
  }

  async function recuperar() {
    if (!email.trim()) { setMsg("Informe o e-mail para recuperar a senha."); return; }
    await sendPasswordResetEmail(getClientAuth(), email.trim()).catch(() => {});
    setMsg("Se o e-mail estiver cadastrado, você receberá as instruções.");
  }

  return (
    <div className="mx-auto mt-16 w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="mb-1 text-lg font-semibold text-[#1f3a5f]">Controle de Láureas — Equipe B</h1>
      <p className="mb-4 text-sm text-slate-600">Acesso restrito a usuários autorizados.</p>
      <form onSubmit={entrar} className="flex flex-col gap-3">
        <label className="text-sm">E-mail
          <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2" />
        </label>
        <label className="text-sm">Senha
          <input type="password" required autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2" />
        </label>
        {msg && <p role="alert" className="text-sm text-red-700">{msg}</p>}
        <button disabled={carregando} className="rounded bg-[#1f3a5f] px-4 py-2 font-medium text-white disabled:opacity-60">
          {carregando ? "Entrando…" : "Entrar"}
        </button>
        <button type="button" onClick={recuperar} className="text-sm text-[#1f3a5f] underline">Esqueci a senha</button>
      </form>
    </div>
  );
}
