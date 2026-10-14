// Login: recebe o ID token do Firebase Auth no cliente e grava cookie httpOnly.
// Não concede acesso por si só — exigirSessao() valida a autorização do módulo.
import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

export async function POST(req: NextRequest) {
  const { idToken } = await req.json().catch(() => ({}));
  if (!idToken || typeof idToken !== "string") return NextResponse.json({ erro: "Token ausente" }, { status: 400 });
  try {
    await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ erro: "Token inválido" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("session", idToken, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: 60 * 55, // ~55 min (tokens valem 1h)
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("session", "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
