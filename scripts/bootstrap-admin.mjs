// Bootstrap do PRIMEIRO administrador — procedimento restrito e documentado.
// Uso: node scripts/bootstrap-admin.mjs <UID_DO_FIREBASE_AUTH> <EMAIL>
// Requer credenciais de serviço no ambiente (ou emuladores ativos).
// Só funciona quando ainda não existe nenhum admin ativo; cria o documento de autorização do módulo.
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const [uid, email] = process.argv.slice(2);
if (!uid || !email) { console.error("Uso: node scripts/bootstrap-admin.mjs <UID> <EMAIL>"); process.exit(1); }

const projectId = process.env.FIREBASE_PROJECT_ID;
const app = process.env.FIRESTORE_EMULATOR_HOST
  ? initializeApp({ projectId: projectId ?? "demo-controle-laureas" })
  : initializeApp(process.env.FIREBASE_PRIVATE_KEY
      ? { credential: cert({ projectId, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }), projectId }
      : { credential: applicationDefault(), projectId });
const db = getFirestore(app);

const admins = await db.collection("moduloUsuarios").where("perfil", "==", "admin").where("ativo", "==", true).get();
if (!admins.empty) { console.error("Já existe administrador ativo. Use a tela de Administração."); process.exit(1); }

await db.collection("moduloUsuarios").doc(uid).set({
  email, equipeId: "equipe-b", perfil: "admin", ativo: true,
  integranteId: null, criadoEm: FieldValue.serverTimestamp(), criadoPor: "bootstrap",
});
await db.collection("auditoria").add({ acao: "bootstrap.admin", entidade: "moduloUsuario", entidadeId: uid, autorUid: "bootstrap", autorEmail: email, em: FieldValue.serverTimestamp() });
console.log(`Administrador criado: ${email} (${uid}) — equipe-b`);
