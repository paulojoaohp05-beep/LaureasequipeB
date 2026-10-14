// Exportação de relatórios .xlsx — autorização verificada no servidor.
import { NextRequest, NextResponse } from "next/server";
import { exigirSessao } from "@/server/session";
import * as db from "@/server/db";
import { xlsxEfetivo, xlsxElogios, xlsxLaureas, xlsxParticipacao } from "@/lib/export";
import { periodoBounds, dentroPeriodo } from "@/lib/dates";
import { ErroPermissao } from "@/lib/elogios";

const EQUIPE = "equipe-b";

export async function GET(req: NextRequest) {
  try {
    const s = await exigirSessao();
    if (s.usuario.equipeId !== EQUIPE) return NextResponse.json({ erro: "Equipe não autorizada" }, { status: 403 });
    const p = req.nextUrl.searchParams;
    const tipo = p.get("tipo") ?? "efetivo";
    const periodo = p.get("periodo") ?? "mes-atual";
    const criterio = (p.get("criterio") ?? "solicitacao") as "solicitacao" | "publicacao" | "concessao";
    const { de, ate } = periodoBounds(periodo as never, p.get("de") ?? undefined, p.get("ate") ?? undefined);
    const filtros = `período ${de} a ${ate}; critério de data: ${criterio}`;

    const integrantes = await db.listarIntegrantes();
    const nomes = new Map(integrantes.map(i => [i.id, i.nomeGuerra || i.nome]));
    let buf: Buffer; let nome = `${tipo}.xlsx`;

    if (tipo === "efetivo") {
      const comp = integrantes.map(i => ({ ...i, ingressoEquipe: i.complemento?.ingressoEquipe }));
      buf = await xlsxEfetivo(comp, filtros);
    } else if (tipo === "elogios") {
      const todos = await db.listarElogios(EQUIPE);
      const items = todos.filter(e => dentroPeriodo(criterio === "publicacao" ? e.dataPublicacao : e.dataSolicitacao, de, ate) === true);
      buf = await xlsxElogios(items, nomes, filtros);
    } else if (tipo === "laureas") {
      const todos = await db.listarLaureas(EQUIPE);
      const items = todos.filter(l => dentroPeriodo(l.dataConcessao, de, ate) === true);
      buf = await xlsxLaureas(items, nomes, filtros);
    } else if (tipo === "participacao") {
      const todos = await db.listarElogios(EQUIPE);
      const mapa = new Map<string, { solicitacoes: number; publicacoes: number; pendencias: number }>();
      for (const e of todos.filter(e => dentroPeriodo(criterio === "publicacao" ? e.dataPublicacao : e.dataSolicitacao, de, ate) === true)) {
        const v = mapa.get(e.solicitanteId) ?? { solicitacoes: 0, publicacoes: 0, pendencias: 0 };
        v.solicitacoes++; if (e.situacao === "publicado") v.publicacoes++; if (e.situacao === "solicitado") v.pendencias++;
        mapa.set(e.solicitanteId, v);
      }
      buf = await xlsxParticipacao([...mapa.entries()].map(([id, v]) => ({ sargento: nomes.get(id) ?? id, ...v })), filtros);
    } else {
      return NextResponse.json({ erro: "Tipo inválido" }, { status: 400 });
    }

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nome}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof ErroPermissao) return NextResponse.json({ erro: e.message }, { status: 403 });
    return NextResponse.json({ erro: "Falha ao gerar relatório" }, { status: 500 });
  }
}
