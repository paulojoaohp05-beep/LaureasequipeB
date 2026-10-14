"use server";
// Todas as operações verificam sessão, autorização do módulo, equipe e perfil no servidor.
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { exigirSessao, exigirPerfil } from "./session";
import * as db from "./db";
import { COL } from "./db";
import { assertPodeEditar, assertPodePublicarOuCancelar, assertPublicacaoCompleta, assertSolicitante, assertTransicao, ErroValidacao } from "@/lib/elogios";
import { isDataCivil, periodoBounds, dentroPeriodo, hojeSP } from "@/lib/dates";
import { lerPlanilha, reconciliar, hashPlanilhaRe } from "@/lib/planilha";
import type { Elogio, Laurea, Perfil, FiltroPeriodo } from "@/lib/types";

const EQUIPE = "equipe-b";

function assertEquipe(s: { usuario: { equipeId: string } }) {
  if (s.usuario.equipeId !== EQUIPE) throw new ErroValidacao("Usuário não pertence a esta equipe");
}

// ---------- Consultas ----------
export async function obterDashboard(filtro: FiltroPeriodo) {
  const s = await exigirSessao(); assertEquipe(s);
  const { de, ate } = periodoBounds(filtro.tipo, filtro.de, filtro.ate);
  const [integrantes, elogios, laureas] = await Promise.all([
    db.listarIntegrantes(), db.listarElogios(EQUIPE), db.listarLaureas(EQUIPE),
  ]);
  const ativos = integrantes.filter(i => !i.situacao || i.situacao === "ativo");

  const dataElogio = (e: Elogio) => filtro.criterio === "publicacao" ? e.dataPublicacao : e.dataSolicitacao;
  const elogiosPeriodo = elogios.filter(e => dentroPeriodo(dataElogio(e), de, ate) === true);
  const laureasPeriodo = laureas.filter(l => dentroPeriodo(l.dataConcessao, de, ate) === true);

  const porSargento = new Map<string, { solicitacoes: number; publicacoes: number; pendencias: number }>();
  const sgtNome = new Map(integrantes.map(i => [i.id, i.nomeGuerra || i.nome]));
  // Sargentos solicitantes sem registros: incluir todos com graduação de sgt/subten? Mantemos os que têm registros + flag "sem dados".
  for (const e of elogiosPeriodo) {
    const p = porSargento.get(e.solicitanteId) ?? { solicitacoes: 0, publicacoes: 0, pendencias: 0 };
    p.solicitacoes++;
    if (e.situacao === "publicado") p.publicacoes++;
    if (e.situacao === "solicitado") p.pendencias++;
    porSargento.set(e.solicitanteId, p);
  }
  const participacao = [...porSargento.entries()].map(([id, v]) => ({ sargento: sgtNome.get(id) ?? id, ...v }));

  // Evolução mensal
  const porMes = new Map<string, { elogios: number; laureas: number }>();
  for (const e of elogiosPeriodo) { const m = dataElogio(e)!.slice(0, 7); const v = porMes.get(m) ?? { elogios: 0, laureas: 0 }; v.elogios++; porMes.set(m, v); }
  for (const l of laureasPeriodo) { const m = l.dataConcessao.slice(0, 7); const v = porMes.get(m) ?? { elogios: 0, laureas: 0 }; v.laureas++; porMes.set(m, v); }
  const evolucao = [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, v]) => ({ mes, ...v }));

  // Distribuição por grau de láurea (grau mais alto registrado; falta de histórico ≠ zero confirmado)
  const grauMaior = new Map<string, number>();
  const integrantesComLaurea = new Set(laureas.map(l => l.integranteId));
  for (const l of laureas) {
    const g = parseInt(l.grau) || 0;
    if (g > (grauMaior.get(l.integranteId) ?? 0)) grauMaior.set(l.integranteId, g);
  }
  const distribuicao: Record<string, number> = { "1º": 0, "2º": 0, "3º": 0, "4º": 0, "5º": 0 };
  for (const g of grauMaior.values()) distribuicao[`${g}º`] = (distribuicao[`${g}º`] ?? 0) + 1;
  const semLaurea = ativos.filter(i => !integrantesComLaurea.has(i.id)).length;

  return {
    efetivoAtivo: ativos.length, // total atual — não varia com o período
    elogiosSolicitados: elogiosPeriodo.filter(e => e.situacao === "solicitado").length,
    elogiosPublicados: elogiosPeriodo.filter(e => e.situacao === "publicado").length,
    laureasPeriodo: laureasPeriodo.length,
    pendentes: elogios.filter(e => e.situacao === "solicitado").length,
    participacao, evolucao, distribuicao, semLaurea,
    ultimos: elogios.slice(0, 10).map(e => ({ id: e.id, titulo: e.titulo, situacao: e.situacao, data: dataElogio(e), destinatarios: e.destinatarioIds.map(id => sgtNome.get(id) ?? id) })),
    criterioData: filtro.criterio, de, ate,
  };
}

export async function obterEfetivo() {
  const s = await exigirSessao(); assertEquipe(s);
  return db.listarIntegrantes(); // já retorna mestre `membros` + complemento mesclado
}

export async function obterFicha(integranteId: string) {
  const s = await exigirSessao(); assertEquipe(s);
  const [doc, laureas] = await Promise.all([
    db.buscarIntegrante(integranteId), db.laureasDoIntegrante(integranteId),
  ]);
  if (!doc) return null;
  const { complemento, ...i } = doc;
  const todos = await db.listarElogios(EQUIPE);
  const elogios = todos.filter(e => e.destinatarioIds.includes(integranteId));
  return { integrante: i, complemento, laureas, elogios };
}

export async function obterElogios() { const s = await exigirSessao(); assertEquipe(s); return db.listarElogios(EQUIPE); }
export async function obterLaureas() { const s = await exigirSessao(); assertEquipe(s); return db.listarLaureas(EQUIPE); }

// ---------- Mutações: elogios ----------
export async function criarElogio(input: { titulo: string; descricao?: string; destinatarioIds: string[]; solicitanteId: string; dataSolicitacao?: string }) {
  const s = await exigirSessao(); assertEquipe(s);
  if (s.usuario.perfil === "visualizador") throw new ErroValidacao("Perfil de visualização não pode criar registros");
  if (!input.titulo?.trim()) throw new ErroValidacao("Título obrigatório");
  if (!input.destinatarioIds.length) throw new ErroValidacao("Selecione ao menos um destinatário");
  assertSolicitante(s.usuario.perfil, input.solicitanteId, s.usuario.integranteId);
  const dataSolicitacao = input.dataSolicitacao && isDataCivil(input.dataSolicitacao) ? input.dataSolicitacao : hojeSP();

  const ref = adminDb.collection(COL.elogios).doc();
  const elogio = {
    equipeId: EQUIPE, destinatarioIds: input.destinatarioIds, solicitanteId: input.solicitanteId,
    lancadoPorUid: s.uid, titulo: input.titulo.trim(), descricao: input.descricao?.trim() ?? "",
    dataSolicitacao, situacao: "solicitado" as const,
    criadoEm: FieldValue.serverTimestamp(), atualizadoEm: FieldValue.serverTimestamp(),
  };
  await adminDb.runTransaction(async t => {
    t.create(ref, elogio);
    t.create(adminDb.collection(COL.auditoria).doc(), { acao: "elogio.criar", entidade: "elogio", entidadeId: ref.id, autorUid: s.uid, autorEmail: s.email, em: FieldValue.serverTimestamp() });
  });
  return { id: ref.id };
}

export async function publicarElogio(id: string, campos: { dataPublicacao: string; referencia: string }) {
  const s = await exigirSessao(); assertEquipe(s);
  assertPodePublicarOuCancelar(s.usuario.perfil);
  assertPublicacaoCompleta(campos);
  if (!isDataCivil(campos.dataPublicacao)) throw new ErroValidacao("Data de publicação inválida");
  const ref = adminDb.collection(COL.elogios).doc(id);
  await adminDb.runTransaction(async t => {
    const d = await t.get(ref);
    if (!d.exists) throw new ErroValidacao("Registro não encontrado");
    const e = { id: d.id, ...d.data() } as Elogio;
    if (e.equipeId !== EQUIPE) throw new ErroValidacao("Registro de outra equipe");
    assertTransicao(e, "publicado");
    t.update(ref, { situacao: "publicado", dataPublicacao: campos.dataPublicacao, referencia: campos.referencia.trim(), publicadoEm: FieldValue.serverTimestamp(), publicadoPorUid: s.uid, atualizadoEm: FieldValue.serverTimestamp() });
    t.create(adminDb.collection(COL.auditoria).doc(), { acao: "elogio.publicar", entidade: "elogio", entidadeId: id, autorUid: s.uid, autorEmail: s.email, em: FieldValue.serverTimestamp() });
  });
}

export async function cancelarElogio(id: string, justificativa: string) {
  const s = await exigirSessao(); assertEquipe(s);
  assertPodePublicarOuCancelar(s.usuario.perfil);
  if (!justificativa?.trim()) throw new ErroValidacao("Justificativa obrigatória para cancelar");
  const ref = adminDb.collection(COL.elogios).doc(id);
  await adminDb.runTransaction(async t => {
    const d = await t.get(ref);
    if (!d.exists) throw new ErroValidacao("Registro não encontrado");
    const e = { id: d.id, ...d.data() } as Elogio;
    assertTransicao(e, "cancelado");
    t.update(ref, { situacao: "cancelado", justificativaCancelamento: justificativa.trim(), canceladoEm: FieldValue.serverTimestamp(), canceladoPorUid: s.uid, atualizadoEm: FieldValue.serverTimestamp() });
    t.create(adminDb.collection(COL.auditoria).doc(), { acao: "elogio.cancelar", entidade: "elogio", entidadeId: id, autorUid: s.uid, autorEmail: s.email, em: FieldValue.serverTimestamp() });
  });
}

export async function editarElogio(id: string, campos: { titulo?: string; descricao?: string }) {
  const s = await exigirSessao(); assertEquipe(s);
  const ref = adminDb.collection(COL.elogios).doc(id);
  await adminDb.runTransaction(async t => {
    const d = await t.get(ref);
    if (!d.exists) throw new ErroValidacao("Registro não encontrado");
    const e = { id: d.id, ...d.data() } as Elogio;
    assertPodeEditar(e, s.usuario.perfil, s.uid);
    t.update(ref, { ...(campos.titulo !== undefined && { titulo: campos.titulo.trim() }), ...(campos.descricao !== undefined && { descricao: campos.descricao.trim() }), atualizadoEm: FieldValue.serverTimestamp() });
    t.create(adminDb.collection(COL.auditoria).doc(), { acao: "elogio.editar", entidade: "elogio", entidadeId: id, autorUid: s.uid, autorEmail: s.email, em: FieldValue.serverTimestamp(), campos });
  });
}

// ---------- Mutações: láureas ----------
export async function registrarLaurea(input: { integranteId: string; grau: string; dataConcessao: string; dataPublicacao?: string; referencia?: string; solicitanteId?: string; observacao?: string }) {
  const s = await exigirPerfil("admin"); assertEquipe(s);
  if (!isDataCivil(input.dataConcessao)) throw new ErroValidacao("Data da concessão inválida ou ausente");
  if (!["1º", "2º", "3º", "4º", "5º"].includes(input.grau)) throw new ErroValidacao("Grau inválido");
  const ref = adminDb.collection(COL.laureas).doc();
  await adminDb.runTransaction(async t => {
    t.create(ref, {
      equipeId: EQUIPE, integranteId: input.integranteId, grau: input.grau,
      dataConcessao: input.dataConcessao, dataPublicacao: input.dataPublicacao ?? null,
      referencia: input.referencia?.trim() ?? "", solicitanteId: input.solicitanteId ?? null,
      observacao: input.observacao?.trim() ?? "", criadoEm: FieldValue.serverTimestamp(), criadoPorUid: s.uid,
    });
    t.create(adminDb.collection(COL.auditoria).doc(), { acao: "laurea.registrar", entidade: "laurea", entidadeId: ref.id, autorUid: s.uid, autorEmail: s.email, em: FieldValue.serverTimestamp() });
  });
  return { id: ref.id };
}

// ---------- Administração ----------
export async function definirUsuario(uid: string, dados: { integranteId?: string; perfil: Perfil; ativo: boolean }) {
  const s = await exigirPerfil("admin"); assertEquipe(s);
  if (!["admin", "editor", "visualizador"].includes(dados.perfil)) throw new ErroValidacao("Perfil inválido");
  const atual = await db.buscarUsuario(uid);
  const desativaAdmin = dados.perfil !== "admin" || dados.ativo === false;
  if (atual?.perfil === "admin" && atual.ativo && desativaAdmin) {
    const admins = await db.contarAdminsAtivos();
    if (admins <= 1) throw new ErroValidacao("Não é possível remover/desativar o último administrador");
  }
  await adminDb.collection(COL.usuarios).doc(uid).set({
    email: atual?.email ?? "", integranteId: dados.integranteId ?? null, equipeId: EQUIPE,
    perfil: dados.perfil, ativo: dados.ativo,
    atualizadoEm: FieldValue.serverTimestamp(), atualizadoPorUid: s.uid,
    ...(atual ? {} : { criadoEm: FieldValue.serverTimestamp(), criadoPor: s.uid }),
  }, { merge: true });
  await db.auditar({ acao: "usuario.definir", entidade: "moduloUsuario", entidadeId: uid, autorUid: s.uid, autorEmail: s.email, campos: { perfil: { antes: atual?.perfil, depois: dados.perfil }, ativo: { antes: atual?.ativo, depois: dados.ativo } } });
}

export async function listarUsuariosAdmin() {
  const s = await exigirPerfil("admin"); assertEquipe(s);
  return db.listarUsuarios();
}

// ---------- Importação assistida ----------
export async function importarPlanilha(base64: string, nomeArquivo: string, modo: "simulacao" | "gravacao", resolucao?: { criarNaoEncontrados: boolean }) {
  const s = await exigirPerfil("admin"); assertEquipe(s);
  const buf = Buffer.from(base64, "base64");
  if (buf.length > 5 * 1024 * 1024) throw new ErroValidacao("Arquivo muito grande (máx. 5 MB)");
  const leitura = lerPlanilha(buf);
  const cadastro = await db.listarIntegrantes();
  const { resultados, resumo } = reconciliar(leitura.linhas, cadastro);
  const hash = hashPlanilhaRe(buf);

  const rel = {
    lidas: leitura.linhas.length, invalidas: leitura.invalidas,
    porGraduacao: leitura.porGraduacao, resumoRodape: leitura.resumoRodape,
    divergenciaRodape: leitura.divergenciaRodape, ...resumo,
    detalhes: resultados.map(r => r.tipo === "nao-encontrado" ? { tipo: r.tipo, linha: r.linha.linha, re: r.linha.re, nome: r.linha.nome }
      : r.tipo === "divergente" ? { tipo: r.tipo, integranteId: r.integrante.id, diffs: r.diffs }
      : r.tipo === "ambiguas" ? { tipo: r.tipo, linha: r.linha.linha, re: r.linha.re, candidatos: r.candidatos.map(c => c.id) }
      : { tipo: r.tipo, integranteId: r.integrante.id }),
    hash,
  };

  if (modo === "simulacao") return { modo, ...rel, aplicados: 0, criados: 0 };

  // Gravação: prioriza vincular existentes; cria novos apenas se confirmado
  const batch = adminDb.batch();
  let aplicados = 0, criados = 0;
  for (const r of resultados) {
    if (r.tipo === "complemento") {
      // Função vem da planilha e mora no complemento — `membros` (legado) não é tocado.
      batch.set(adminDb.collection(COL.complementos).doc(r.integrante.id),
        { integranteId: r.integrante.id, funcao: r.linha.funcao, schemaVersion: 1 }, { merge: true });
      aplicados++;
    } else if (r.tipo === "nao-encontrado" && resolucao?.criarNaoEncontrados) {
      // Criar em `membros` só campos canônicos (re/nome/posto_grad) — afeta a Gestão de Caixa;
      // por isso só ocorre após confirmação explícita do administrador.
      const novo = adminDb.collection(COL.membros).doc();
      batch.create(novo, { re: r.linha.re, nome: r.linha.nome, posto_grad: r.linha.graduacao });
      batch.create(adminDb.collection(COL.complementos).doc(novo.id), {
        integranteId: novo.id, funcao: r.linha.funcao || null, origemImportacao: hash,
        camposPendentes: ["ingressoEquipe", "ingressoPM", "nomeGuerra"], schemaVersion: 1,
      });
      criados++;
    }
    // divergentes e ambíguas nunca são resolvidos silenciosamente
  }
  const impRef = adminDb.collection(COL.importacoes).doc();
  batch.create(impRef, { equipeId: EQUIPE, arquivoHash: hash, arquivoNome: nomeArquivo, autorUid: s.uid, modo, iniciadoEm: FieldValue.serverTimestamp(), resumo: { lidas: rel.lidas, ...resumo, criados, aplicados } });
  batch.create(adminDb.collection(COL.auditoria).doc(), { acao: "importacao.executar", entidade: "importacao", entidadeId: impRef.id, autorUid: s.uid, autorEmail: s.email, em: FieldValue.serverTimestamp() });
  await batch.commit();
  return { modo, ...rel, aplicados, criados };
}

// ---------- Complemento cadastral (admin) ----------
export async function salvarComplemento(integranteId: string, dados: { ingressoEquipe?: string; ingressoPM?: string; nomeGuerra?: string; funcao?: string; situacaoEquipe?: string }) {
  const s = await exigirPerfil("admin"); assertEquipe(s);
  if (dados.ingressoEquipe && !isDataCivil(dados.ingressoEquipe)) throw new ErroValidacao("Data de ingresso inválida");
  if (dados.ingressoPM && !isDataCivil(dados.ingressoPM)) throw new ErroValidacao("Data de ingresso na PM inválida");
  const pendentes: string[] = [];
  if (!dados.ingressoEquipe) pendentes.push("ingressoEquipe");
  if (!dados.ingressoPM) pendentes.push("ingressoPM");
  // merge parcial: campos ausentes ficam ausentes; vazios não limpam valores conhecidos
  const limpo = Object.fromEntries(Object.entries(dados).filter(([, v]) => v !== undefined && v !== ""));
  await adminDb.collection(COL.complementos).doc(integranteId).set({ integranteId, ...limpo, camposPendentes: pendentes, schemaVersion: 1 }, { merge: true });
  await db.auditar({ acao: "complemento.salvar", entidade: "efetivoComplemento", entidadeId: integranteId, autorUid: s.uid, autorEmail: s.email });
}
