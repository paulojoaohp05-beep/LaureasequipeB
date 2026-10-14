// SDK do Firebase para o navegador: somente Auth (login) — leituras/escritas passam pelo servidor.
// Inicialização preguiçosa para não quebrar o prerender no build sem variáveis configuradas.
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, type Firestore } from "firebase/firestore";

const cfg = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

let app: FirebaseApp | undefined;
let _auth: Auth | undefined;
let _db: Firestore | undefined;

function getApp(): FirebaseApp {
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(cfg);
    if (process.env.NEXT_PUBLIC_USE_EMULATORS === "true" && typeof window !== "undefined") {
      connectAuthEmulator(getAuth(app), "http://127.0.0.1:9099", { disableWarnings: true });
      connectFirestoreEmulator(getFirestore(app), "127.0.0.1", 8080);
    }
  }
  return app;
}

export function getClientAuth(): Auth {
  if (!_auth) _auth = getAuth(getApp());
  return _auth;
}

export function getClientDb(): Firestore {
  if (!_db) _db = getFirestore(getApp());
  return _db;
}
