// Firebase Admin SDK — EXCLUSIVO ao servidor. Nunca importar em componentes de cliente.
import "server-only";
import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

function init() {
  if (getApps().length) return getApps()[0];
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  }
  // Emuladores ou ADC (Application Default Credentials)
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({ projectId: projectId ?? "demo-controle-laureas" });
  }
  return initializeApp({ credential: applicationDefault(), projectId });
}

const adminApp = init();
export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
