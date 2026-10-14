"use server";
// Todas as operações verificam sessão, autorização do módulo, equipe e perfil no servidor.
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { exigirSessao, exigirPerfil } from "./session";
import * as db from "./db";
import { COL } from "./db";
import { assertPodeEditar, assertPodeCorrigir, assertPodePublicarOuCancelar, assertPublicacaoCompleta, assertSolicitante, assertTransicao, ErroValidacao } from "@/lib/elogios";
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
  const efetivo = integrantes.filter(i => i.complemento?.situacaoEquipe !== "excluido");
  const ativos = efetivo.filter(i => !i.situacao || i.situacao === "ativo");

  const dataElogio = (e: Elogio) => filtro.criterio === "publicacao" ? e.dataPublicacao : e.dataSolicitacao;
  const elogiosPeriodo = elogios.filter(e => dentroPeriodo(dataElogio(e), de, ate) === true);
  const laureasPeriodo = laureas.filter(l => dentroPeriodo(l.dataConcessao, de, ate) === true);

  const porSargento = new Map<string, { solicitacoes: number; publicacoes: number; pendencias: number; negados: number }>();
  const sgtNome = new Map(efetivo.map(i => [i.id, i.nomeGuerra || i.nome]));
  // Sargentos solicitantes sem registros: incluir todos com graduação de sgt/subten? Mantemos os que têm registros + flag "sem dados".
  for (const e of elogiosPeriodo) {
    const p = porSargento.get(e.solicitanteId) ?? { solicitacoes: 0, publicacoes: 0, pendencias: 0, negados: 0 };
    p.solicitacoes++;
    if (e.situacao === "publicado") p.publicacoes++;
    if (e.situacao === "solicitado") p.pendencias++;
    if (e.situacao === "negado") p.negados++;
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
    elogiosNegados: elogiosPeriodo.filter(e => e.situacao === "negado").length,
    participacao, evolucao, distribuicao, semLaurea,
    ultimos: elogios.slice(0, 10).map(e => ({ id: e.id, titulo: e.titulo, situacao: e.situacao, data: dataElogio(e), destinatarios: e.destinatarioIds.map(id => sgtNome.get(id) ?? id) })),
    criterioData: filtro.criterio, de, ate,
  };
}

export async function obterEfetivo(opts?: { incluirExcluidos?: boolean }) {
  const s = await exigirSessao(); assertEquipe(s);
  const [todos, elogios, laureas] = await Promise.all([
    db.listarIntegrantes(), db.listarElogios(EQUIPE), db.listarLaureas(EQUIPE),
  ]);
  const integrantes = opts?.incluirExcluidos ? todos : todos.filter(i => i.complemento?.situacaoEquipe !== "excluido");
  // Resumo de reconhecimentos por integrante: nº de elogios publicados + grau de láurea vigente.
  const elogiosPor = new Map<string, number>();
  for (const e of elogios) if (e.situacao === "publicado") for (const d of e.destinatarioIds) elogiosPor.set(d, (elogiosPor.get(d) ?? 0) + 1);
  // Grau vigente = maior grau concedido; em empate, o mais recente.
  const grauPor = new Map<string, { grau: string; data: string }>();
  for (const l of laureas) {
    const g = parseInt(l.grau) || 0;
    const at = grauPor.get(l.integranteId);
    if (!at || g > parseInt(at.grau) || (g === parseInt(at.grau) && l.dataConcessao > at.data)) grauPor.set(l.integranteId, { grau: l.grau, data: l.dataConcessao });
  }
  return integrantes.map(i => ({
    ...i,
    totalElogiosPublicados: elogiosPor.get(i.id) ?? null, // null = sem registro (não presume zero confirmado)
    laureaVigente: grauPor.get(i.id) ?? null,
  }));
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
export async function criarElogio(input: { titulo: string; descricao?: string; destinatarioIds: string[]; solicitanteId: string; dataSolicitacao?: string; jaPublicado?: boolean; dataPublicacao?: string; referencia?: string }) {
  const s = await exigirSessao(); assertEquipe(s);
  if (s.usuario.perfil === "visualizador") throw new ErroValidacao("Perfil de visualização não pode criar registros");
  if (!input.titulo?.trim()) throw new ErroValidacao("Título obrigatório");
  if (!input.destinatarioIds.length) throw new ErroValidacao("Selecione ao menos um destinatário");
  assertSolicitante(s.usuario.perfil, input.solicitanteId, s.usuario.integranteId);
  const dataSolicitacao = input.dataSolicitacao && isDataCivil(input.dataSolicitacao) ? input.dataSolicitacao : hojeSP();

  const ref = adminDb.collection(COL.elogios).doc();
  const base = {
    equipeId: EQUIPE, destinatarioIds: input.destinatarioIds, solicitanteId: input.solicitanteId,
    lancadoPorUid: s.uid, titulo: input.titulo.trim(), descricao: input.descricao?.trim() ?? "",
    dataSolicitacao, referencia: input.referencia?.trim() ?? "",
    criadoEm: FieldValue.serverTimestamp(), atualizadoEm: FieldValue.serverTimestamp(),
  };
  if (input.jaPublicado) {
    assertPodePublicarOuCancelar(s.usuario.perfil);
    assertPublicacaoCompleta({ dataPublicacao: input.dataPublicacao, referencia: input.referencia });
    if (!isDataCivil(input.dataPublicacao!)) throw new ErroValidacao("Data de publicação inválida");
    const elogio = { ...base, situacao: "publicado" as const, dataPublicacao: input.dataPublicacao!, referencia: input.referencia!.trim(), publicadoEm: FieldValue.serverTimestamp(), publicadoPorUid: s.uid };
    await adminDb.runTransaction(async t => {
      t.create(ref, elogio);
      t.create(adminDb.collection(COL.auditoria).doc(), { acao: "elogio.criar-publicado", entidade: "elogio", entidadeId: ref.id, autorUid: s.uid, autorEmail: s.email, em: FieldValue.serverTimestamp() });
    });
    return { id: ref.id };
  }
  const elogio = { ...base, situacao: "solicitado" as const };
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

export async function negarElogio(id: string, justificativa: string) {
  const s = await exigirSessao(); assertEquipe(s);
  assertPodePublicarOuCancelar(s.usuario.perfil);
  if (!justificativa?.trim()) throw new ErroValidacao("Justificativa obrigatória para negar");
  const ref = adminDb.collection(COL.elogios).doc(id);
  await adminDb.runTransaction(async t => {
    const d = await t.get(ref);
    if (!d.exists) throw new ErroValidacao("Registro não encontrado");
    const e = { id: d.id, ...d.data() } as Elogio;
    assertTransicao(e, "negado");
    t.update(ref, { situacao: "negado", justificativaNegativa: justificativa.trim(), negadoEm: FieldValue.serverTimestamp(), negadoPorUid: s.uid, atualizadoEm: FieldValue.serverTimestamp() });
    t.create(adminDb.collection(COL.auditoria).doc(), { acao: "elogio.negar", entidade: "elogio", entidadeId: id, autorUid: s.uid, autorEmail: s.email, em: FieldValue.serverTimestamp() });
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

export async function editarElogio(id: string, campos: { titulo?: string; descricao?: string; destinatarioIds?: string[]; solicitanteId?: string; dataSolicitacao?: string; referencia?: string }) {
  const s = await exigirSessao(); assertEquipe(s);
  if (campos.dataSolicitacao !== undefined && !isDataCivil(campos.dataSolicitacao)) throw new ErroValidacao("Data da solicitação inválida");
  if (campos.destinatarioIds !== undefined && !campos.destinatarioIds.length) throw new ErroValidacao("Selecione ao menos um destinatário");
  const ref = adminDb.collection(COL.elogios).doc(id);
  await adminDb.runTransaction(async t => {
    const d = await t.get(ref);
    if (!d.exists) throw new ErroValidacao("Registro não encontrado");
    const e = { id: d.id, ...d.data() } as Elogio;
    if (e.situacao !== "rascunho" && e.situacao !== "solicitado") throw new ErroValidacao("Use corrigir para registros publicados/negados");
    assertPodeEditar(e, s.usuario.perfil, s.uid);
    const antes: Record<string, { antes?: unknown; depois?: unknown }> = {};
    const upd: Record<string, unknown> = { atualizadoEm: FieldValue.serverTimestamp() };
    if (campos.titulo !== undefined) { upd.titulo = campos.titulo.trim(); antes.titulo = { antes: e.titulo, depois: upd.titulo }; }
    if (campos.descricao !== undefined) { upd.descricao = campos.descricao.trim(); antes.descricao = { antes: e.descricao, depois: upd.descricao }; }
    if (campos.destinatarioIds !== undefined) { upd.destinatarioIds = campos.destinatarioIds; antes.destinatarioIds = { antes: e.destinatarioIds, depois: upd.destinatarioIds }; }
    if (campos.solicitanteId !== undefined) { upd.solicitanteId = campos.solicitanteId; antes.solicitanteId = { antes: e.solicitanteId, depois: upd.solicitanteId }; }
    if (campos.dataSolicitacao !== undefined) { upd.dataSolicitacao = campos.dataSolicitacao; antes.dataSolicitacao = { antes: e.dataSolicitacao, depois: upd.dataSolicitacao }; }
    if (campos.referencia !== undefined) { upd.referencia = campos.referencia.trim(); antes.referencia = { antes: e.referencia, depois: upd.referencia }; }
    t.update(ref, upd);
    t.create(adminDb.collection(COL.auditoria).doc(), { acao: "elogio.editar", entidade: "elogio", entidadeId: id, autorUid: s.uid, autorEmail: s.email, em: FieldValue.serverTimestamp(), campos: antes });
  });
}

/** Correção de publicado/negado sem mudar a situação — só admin/gestor. */
export async function corrigirElogio(id: string, campos: { titulo?: string; descricao?: string; dataSolicitacao?: string; dataPublicacao?: string; referencia?: string; justificativaNegativa?: string }) {
  const s = await exigirSessao(); assertEquipe(s);
  assertPodeCorrigir(s.usuario.perfil);
  if (campos.dataSolicitacao !== undefined && !isDataCivil(campos.dataSolicitacao)) throw new ErroValidacao("Data da solicitação inválida");
  if (campos.dataPublicacao !== undefined && !isDataCivil(campos.dataPublicacao)) throw new ErroValidacao("Data de publicação inválida");
  const ref = adminDb.collection(COL.elogios).doc(id);
  await adminDb.runTransaction(async t => {
    const d = await t.get(ref);
    if (!d.exists) throw new ErroValidacao("Registro não encontrado");
    const e = { id: d.id, ...d.data() } as Elogio;
    if (e.situacao !== "publicado" && e.situacao !== "negado") throw new ErroValidacao("Correção vale apenas para publicados/negados");
    const camposAud: Record<string, { antes?: unknown; depois?: unknown }> = {};
    const upd: Record<string, unknown> = { atualizadoEm: FieldValue.serverTimestamp() };
    for (const k of ["titulo", "descricao", "dataSolicitacao", "dataPublicacao", "referencia", "justificativaNegativa"] as const) {
      const v = campos[k];
      if (v !== undefined) { upd[k] = typeof v === "string" ? v.trim() : v; camposAud[k] = { antes: e[k], depois: upd[k] }; }
    }
    // Publicado não pode ficar sem data de publicação nem Boletim Interno Nº.
    if (e.situacao === "publicado") {
      const dp = (upd.dataPublicacao as string | undefined) ?? e.dataPublicacao;
      const rf = (upd.referencia as string | undefined) ?? e.referencia;
      if (!dp || !rf?.trim()) throw new ErroValidacao("Publicado exige data de publicação e Boletim Interno Nº");
    }
    t.update(ref, upd);
    if (Object.keys(camposAud).length) {
      t.create(adminDb.collection(COL.auditoria).doc(), { acao: "elogio.corrigir", entidade: "elogio", entidadeId: id, autorUid: s.uid, autorEmail: s.email, em: FieldValue.serverTimestamp(), campos: camposAud });
    }
  });
}

// ---------- Mutações: láureas ----------
export async function registrarLaurea(input: { integranteId: string; grau: string; dataConcessao: string; dataPublicacao?: string; referencia?: string; solicitanteId?: string; observacao?: string }) {
  const s = await exigirPerfil("admin", "gestor"); assertEquipe(s);
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

export async function editarLaurea(id: string, campos: { integranteId?: string; grau?: string; dataConcessao?: string; dataPublicacao?: string; referencia?: string; solicitanteId?: string; observacao?: string }) {
  const s = await exigirPerfil("admin", "gestor"); assertEquipe(s);
  if (campos.dataConcessao !== undefined && !isDataCivil(campos.dataConcessao)) throw new ErroValidacao("Data da concessão inválida ou ausente");
  if (campos.dataPublicacao !== undefined && campos.dataPublicacao !== "" && !isDataCivil(campos.dataPublicacao)) throw new ErroValidacao("Data de publicação inválida");
  if (campos.grau !== undefined && !["1º", "2º", "3º", "4º", "5º"].includes(campos.grau)) throw new ErroValidacao("Grau inválido");
  const ref = adminDb.collection(COL.laureas).doc(id);
  await adminDb.runTransaction(async t => {
    const d = await t.get(ref);
    if (!d.exists) throw new ErroValidacao("Registro não encontrado");
    const l = { id: d.id, ...d.data() } as Laurea;
    const camposAud: Record<string, { antes?: unknown; depois?: unknown }> = {};
    const upd: Record<string, unknown> = {};
    for (const k of ["integranteId", "grau", "dataConcessao", "dataPublicacao", "referencia", "solicitanteId", "observacao"] as const) {
      const v = campos[k];
      if (v !== undefined) { upd[k] = typeof v === "string" ? v.trim() : v; camposAud[k] = { antes: l[k], depois: upd[k] }; }
    }
    if (!Object.keys(upd).length) return;
    t.update(ref, upd);
    t.create(adminDb.collection(COL.auditoria).doc(), { acao: "laurea.editar", entidade: "laurea", entidadeId: id, autorUid: s.uid, autorEmail: s.email, em: FieldValue.serverTimestamp(), campos: camposAud });
  });
}

// ---------- Administração ----------
export async function definirUsuario(uid: string, dados: { integranteId?: string; perfil: Perfil; ativo: boolean }) {
  const s = await exigirPerfil("admin"); assertEquipe(s);
  if (!["admin", "gestor", "editor", "visualizador"].includes(dados.perfil)) throw new ErroValidacao("Perfil inválido");
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

// ---------- Efetivo (admin/gestor) — `membros` é o cadastro mestre do legado ----------
// Regras de segurança: nunca apagar docs de `membros` (a Gestão de Caixa depende deles);
// exclusão é lógica, via complemento. Campos pago_semestre_* pertencem ao caixa: criados
// com 0 e jamais tocados depois.
const GRADUACOES = ["CAP PM", "1º TEN PM", "2º TEN PM", "SUBTEN PM", "1º SGT PM", "2º SGT PM", "3º SGT PM", "CB PM", "SD PM"];

export async function criarMembro(input: { re: string; nome: string; graduacao: string; nomeGuerra?: string; ingressoEquipe?: string; ingressoPM?: string }) {
  const s = await exigirPerfil("admin", "gestor"); assertEquipe(s);
  const re = input.re?.trim(), nome = input.nome?.trim();
  if (!re) throw new ErroValidacao("RE obrigatório");
  if (!nome) throw new ErroValidacao("Nome obrigatório");
  if (!GRADUACOES.includes(input.graduacao)) throw new ErroValidacao("Graduação inválida");
  if (input.ingressoEquipe && !isDataCivil(input.ingressoEquipe)) throw new ErroValidacao("Data de ingresso na equipe inválida");
  if (input.ingressoPM && !isDataCivil(input.ingressoPM)) throw new ErroValidacao("Data de ingresso na PM inválida");

  const ref = adminDb.collection(COL.membros).doc();
  const compRef = adminDb.collection(COL.complementos).doc(ref.id);
  await adminDb.runTransaction(async t => {
    const dup = await t.get(adminDb.collection(COL.membros).where("re", "==", re).limit(1));
    if (!dup.empty) throw new ErroValidacao("RE já cadastrado");
    t.create(ref, { re, nome, posto_grad: input.graduacao, pago_semestre_1: 0, pago_semestre_2: 0 });
    const pendentes: string[] = [];
    if (!input.ingressoEquipe) pendentes.push("ingressoEquipe");
    if (!input.ingressoPM) pendentes.push("ingressoPM");
    const comp: Record<string, unknown> = { integranteId: ref.id, situacaoEquipe: "ativo", camposPendentes: pendentes, schemaVersion: 1 };
    if (input.nomeGuerra?.trim()) comp.nomeGuerra = input.nomeGuerra.trim();
    if (input.ingressoEquipe) comp.ingressoEquipe = input.ingressoEquipe;
    if (input.ingressoPM) comp.ingressoPM = input.ingressoPM;
    t.create(compRef, comp);
    t.create(adminDb.collection(COL.auditoria).doc(), { acao: "membro.criar", entidade: "membro", entidadeId: ref.id, autorUid: s.uid, autorEmail: s.email, em: FieldValue.serverTimestamp() });
  });
  return { id: ref.id };
}

export async function editarMembro(id: string, dados: { re?: string; nome?: string; graduacao?: string; nomeGuerra?: string; ingressoEquipe?: string; ingressoPM?: string; situacaoEquipe?: string }) {
  const s = await exigirPerfil("admin", "gestor"); assertEquipe(s);
  if (dados.ingressoEquipe && !isDataCivil(dados.ingressoEquipe)) throw new ErroValidacao("Data de ingresso na equipe inválida");
  if (dados.ingressoPM && !isDataCivil(dados.ingressoPM)) throw new ErroValidacao("Data de ingresso na PM inválida");
  if (dados.graduacao !== undefined && !GRADUACOES.includes(dados.graduacao)) throw new ErroValidacao("Graduação inválida");

  const ref = adminDb.collection(COL.membros).doc(id);
  const compRef = adminDb.collection(COL.complementos).doc(id);
  await adminDb.runTransaction(async t => {
    const [d, c] = await Promise.all([t.get(ref), t.get(compRef)]);
    if (!d.exists) throw new ErroValidacao("Integrante não encontrado");
    const antes = d.data()!;
    const compAntes = c.exists ? c.data()! : {};

    const campos: Record<string, { antes?: unknown; depois?: unknown }> = {};
    const updMestre: Record<string, unknown> = {};
    if (dados.re?.trim() && dados.re.trim() !== antes.re) {
      const dup = await t.get(adminDb.collection(COL.membros).where("re", "==", dados.re.trim()).limit(1));
      if (!dup.empty && dup.docs[0].id !== id) throw new ErroValidacao("RE já cadastrado");
      updMestre.re = dados.re.trim(); campos.re = { antes: antes.re, depois: updMestre.re };
    }
    if (dados.nome?.trim() && dados.nome.trim() !== antes.nome) { updMestre.nome = dados.nome.trim(); campos.nome = { antes: antes.nome, depois: updMestre.nome }; }
    if (dados.graduacao && dados.graduacao !== antes.posto_grad) { updMestre.posto_grad = dados.graduacao; campos.posto_grad = { antes: antes.posto_grad, depois: dados.graduacao }; }
    if (Object.keys(updMestre).length) t.update(ref, updMestre); // nunca toca pago_* nem remove campos

    const updComp: Record<string, unknown> = {};
    for (const k of ["nomeGuerra", "ingressoEquipe", "ingressoPM", "situacaoEquipe"] as const) {
      const v = dados[k];
      if (v !== undefined && v !== "" && v !== compAntes[k]) { updComp[k] = v; campos[k] = { antes: compAntes[k], depois: v }; }
    }
    const final = { ...compAntes, ...updComp };
    const pendentes: string[] = [];
    if (!final.ingressoEquipe) pendentes.push("ingressoEquipe");
    if (!final.ingressoPM) pendentes.push("ingressoPM");
    if (!c.exists) { updComp.integranteId = id; updComp.schemaVersion = 1; }
    t.set(compRef, { ...updComp, camposPendentes: pendentes }, { merge: true });
    if (Object.keys(campos).length) {
      t.create(adminDb.collection(COL.auditoria).doc(), { acao: "membro.editar", entidade: "membro", entidadeId: id, autorUid: s.uid, autorEmail: s.email, em: FieldValue.serverTimestamp(), campos });
    }
  });
}

export async function excluirMembro(id: string, motivo: string) {
  const s = await exigirPerfil("admin", "gestor"); assertEquipe(s);
  if (!motivo?.trim()) throw new ErroValidacao("Motivo da exclusão obrigatório");
  const ref = adminDb.collection(COL.membros).doc(id);
  const compRef = adminDb.collection(COL.complementos).doc(id);
  await adminDb.runTransaction(async t => {
    const d = await t.get(ref);
    if (!d.exists) throw new ErroValidacao("Integrante não encontrado");
    // Exclusão lógica: `membros` (legado) jamais é tocado.
    t.set(compRef, { integranteId: id, situacaoEquipe: "excluido", excluidoEm: FieldValue.serverTimestamp(), excluidoPorUid: s.uid, motivoExclusao: motivo.trim(), schemaVersion: 1 }, { merge: true });
    t.create(adminDb.collection(COL.auditoria).doc(), { acao: "membro.excluir-logico", entidade: "membro", entidadeId: id, autorUid: s.uid, autorEmail: s.email, em: FieldValue.serverTimestamp(), campos: { situacaoEquipe: { depois: "excluido" }, motivoExclusao: { depois: motivo.trim() } } });
  });
}

// ---------- Complemento cadastral (admin) ----------
export async function salvarComplemento(integranteId: string, dados: { ingressoEquipe?: string; ingressoPM?: string; nomeGuerra?: string; funcao?: string; situacaoEquipe?: string }) {
  const s = await exigirPerfil("admin", "gestor"); assertEquipe(s);
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
