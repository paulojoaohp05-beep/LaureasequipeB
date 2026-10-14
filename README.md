# Controle de Láureas — Equipe B

Sistema web para controle do efetivo, elogios e láureas da Equipe B. Next.js + TypeScript + Firebase (Auth + Firestore), deploy na Vercel. Interface em pt-BR, datas `dd/MM/aaaa`, fuso `America/Sao_Paulo`.

## Executar

```bash
npm install
npm run dev        # app em http://localhost:3000
npm test           # testes unitários (vitest)
npm run build      # typecheck + build de produção
```

### Firebase Emulators (desenvolvimento/preview sem dados reais)

```bash
npm i -g firebase-tools
firebase emulators:start   # Firestore :8080, Auth :9099, UI :4000
```

Com `NEXT_PUBLIC_USE_EMULATORS=true`, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` e `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` no `.env.local`, o app usa somente emuladores — nenhuma escrita no cadastro real.

## Variáveis de ambiente

Ver `.env.example`. Credenciais de serviço (`FIREBASE_*`) ficam só no servidor; configuração do cliente usa `NEXT_PUBLIC_`. Na Vercel, configurar separadamente em Development, Preview e Production. Preview deve apontar para emulador/projeto de teste, não para o cadastro real.

## Primeiro administrador (bootstrap)

Após criar a conta do administrador no Firebase Authentication (console → Users → Add user):

```bash
node scripts/bootstrap-admin.mjs <UID> <email>
```

Só funciona quando não há admin ativo; depois disso, acessos são gerenciados na tela **Administração**. O sistema impede remover/desativar o último administrador.

## Modelo de dados (Firestore)

| Coleção | Conteúdo |
| --- | --- |
| `membros/{id}` | **Cadastro mestre (legado, Gestão de Caixa):** `re`, `nome`, `posto_grad`, `pago_semestre_1/2`. O módulo SÓ LÊ — nunca escreve nem adiciona campos aqui. |
| `efetivoComplementos/{membroId}` | Complemento do módulo: `funcao`, `nomeGuerra`, `ingressoEquipe`, `ingressoPM`, `situacaoEquipe`, `camposPendentes`, `schemaVersion`. |
| `efetivoComplementos/{integranteId}` | Complemento do módulo: ingressoEquipe, camposPendentes, schemaVersion. Nunca substitui o mestre. |
| `moduloUsuarios/{uid}` | Autorização do módulo: equipeId, perfil (admin/editor/visualizador), integranteId vinculado, ativo. Desativar aqui não afeta a conta global. |
| `elogios/{id}` | destinatarioIds[], solicitanteId (integrante), lancadoPorUid, situacao (`solicitado`/`publicado`/`cancelado`/`rascunho`), datas, referência, auditoria. |
| `laureas/{id}` | integranteId, grau (1º–5º), dataConcessao, dataPublicacao, referencia, solicitanteId opcional. |
| `auditoria/{id}` | Gerada só no servidor (transações). Não editável/apagável por clientes. |
| `importacoes/{id}` | Lotes de importação: hash do arquivo, modo, resumo. |

> **Pendente de confirmação:** o projeto Firebase real (ID, banco, caminhos e esquema do cadastro) ainda não foi informado. Os nomes acima são a estrutura do módulo implementada e testada com emuladores. Quando o projeto real for identificado, o adaptador em `src/server/db.ts` concentra os nomes de campos do legado, e os eventos ficam ligados ao ID canônico do integrante — sem duplicar o cadastro mestre.

## Regras e índices

`firestore.rules` + `firestore.indexes.json` — **aditivas** ao projeto existente. Antes de publicar em produção, mesclar com as regras atuais e validar que regras permissivas antigas não concedem acesso indevido. Clientes não escrevem diretamente em nenhuma coleção do módulo: toda escrita passa por server actions com Firebase Admin SDK e verificação de sessão/perfil/equipe.

## Importação da planilha

Administração → Importação de efetivo. Simulação sem escrita, relatório por linha (inalterado / complemento / divergente / não encontrado / ambíguo), criação de novos somente após confirmação. RE tratado como texto; linhas ambíguas e divergências nunca são resolvidas silenciosamente; campos vazios não apagam dados existentes. Reprocessar a mesma planilha não duplica registros.

## Matriz de acesso

| Ação | Admin | Editor | Visualizador |
| --- | --- | --- | --- |
| Consultar/exportar | ✓ | ✓ | ✓ |
| Criar solicitação | ✓ | ✓ (solicitante = seu vínculo) | ✗ |
| Editar não publicada | todas | só as próprias | ✗ |
| Publicar/cancelar | ✓ | ✗ | ✗ |
| Láureas | ✓ | ✗ | ✗ |
| Gerenciar acessos | ✓ | ✗ | ✗ |

## Pendências conhecidas

- **Integração real com o Firebase do cadastro:** projeto/banco/caminhos não informados — implementado e testado em emuladores; integração real pendente de credenciais e diagnóstico somente leitura.
- **Nomenclatura dos graus de láurea** (1º–5º) a confirmar com a equipe.
- **Aptidão/interstício/medalha** não implementados — critérios não fornecidos.
- **MFA/TOTP** não implementado (escolhido e-mail/senha).
