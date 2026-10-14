// Login: recebe o ID token do Firebase Auth no cliente e grava cookie httpOnly.
// Não concede acesso por si só — exigirSessao() valida a autorização do módulo.
import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

export async function POST(req: NextRequest) {
  const { idToken } = await req.json().catch(() => ({}));
  if (!idToken || typeof idToken !== "string") return NextResponse.json({ erro: "Token ausente" }, { status: 400 });
  let sessionCookie: string;
  try {
    sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: 14 * 24 * 60 * 60 * 1000 });
  } catch {
    return NextResponse.json({ erro: "Token inválido" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("session", sessionCookie, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: 14 * 24 * 60 * 60, // 14 dias (session cookie do Firebase)
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("session", "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
