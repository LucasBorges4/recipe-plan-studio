# Spec / Critérios de Aceitação

## AC-001: Autenticação

- Given: usuário com email e senha válidos
- When: POST `/login` com `email`, `password`
- Then: retorna `ok: true`, cookie `geos_session` setado, `PublicUser` com `id`, `name`, `email`, `role`

- Given: senha incorreta
- When: POST `/login`
- Then: retorna `ok: false`, `error: "E-mail ou senha inválidos."`, cookie removido

- Given: usuário não existe
- When: POST `/login`
- Then: retorna `ok: false`, `error: "E-mail ou senha inválidos."`, `userFound: false`

## AC-002: Cadastro

- Given: `REGISTRATION_CODE` configurado e código fornecido correto
- When: POST `/register`
- Then: usuário criado, `role: admin` se for o primeiro usuário, `session` criada

- Given: código inválido
- When: POST `/register`
- Then: `ok: false`, `error: "Código de cadastro inválido."`

## AC-003: RBAC

- Given: usuário com função `admin.manage`
- When: `grantUserFunction`
- Then: função adicionada ao usuário, `audit` registrado

## AC-004: Tarefas

- Given: usuário autenticado
- When: `createTaskFn`
- Then: tarefa criada na primeira coluna (`Backlog` se vazio)

- Given: tarefa existente
- When: `moveTaskFn` com `column: "Concluído"`
- Then: tarefa movida, `audit` com `before`/`after`

## AC-005: Comentários

- Given: tarefa existente e usuário autenticado
- When: `addCommentFn`
- Then: comentário inserido, `audit` registrado

## AC-006: Controles

- Given: usuário com `evidence.attach`
- When: `attachEvidenceFn`
- Then: evidência criada com `status: "Em revisão"`

- Given: evidência em revisão
- When: `reviewEvidenceFn` com `approved: true`
- Then: `status: "Aprovada"`, `reviewerName`, `reviewedAt`

## AC-007: Wiki / Docs / Legal

- Given: slug único
- When: `createWikiFn`
- Then: artigo inserido, `version: v1`

- Given: slug existente
- When: `createWikiFn` com mesmo slug
- Then: `ok: false`, `error: "Já existe um artigo com este slug."`

## AC-008: Riscos

- Given: `risk.manage` permitido
- When: `createRiskFn`
- Then: risco inserido, `audit` registrado

- Given: tarefas vencidas e controles vencidos
- When: `generateAutoRisksFn`
- Then: riscos auto-gerados para atrasos e vencimentos

## AC-009: Automação / Próximos Passos

- Given: `AutomationShare` existente
- When: `upsertAutomationShare`
- Then: compartilhamento atualizado ou inserido

- Given: `NextStep` ordenado
- When: `reorderNextSteps`
- Then: posições atualizadas conforme array `orderedIds`

## AC-010: Convites / Reset

- Given: convite válido e não usado
- When: `getInviteByHash`
- Then: retorna `InviteRow` com `usedAt: null`

- Given: convite expirado
- When: `getInviteByHash`
- Then: ainda retorna o convite (validação de expiração é feita pelo chamador)

- Given: token de reset válido
- When: `getResetTokenByHash`
- Then: retorna `ResetToken`

## AC-015: Auditoria

- Given: ação realizada (login, tarefa, controle, etc.)
- When: `insertAudit`
- Then: registro inserido com `id`, `at`, `actor_id`, `actor_name`, `actor_role`, `action`, `entity`, `entity_id`

- Given: `audit.read` permitido
- When: `listAuditFn`
- Then: retorna lista ordenada por `seq DESC`

## AC-011: Cliente vê Acompanhamento 5 etapas, read-only, pode comentar

- Given: usuário com role `cliente` autenticado
- When: acessa `/tarefas` (ou `/acompanhamento`)
- Then: vê 5 etapas (`not_started`, `in_progress`, `waiting_client`, `review`, `done`); tarefas read-only; botão `Comentar` disponível (`task.comment`); progresso visível (0-100); responsável obrigatório quando `waiting_client`.

## AC-012: Cliente bloqueado em automações/admin/auditoria/etc.

- Given: usuário `cliente`
- When: tenta acessar `/automacoes`, `/admin`, `/auditoria`
- Then: retorna `403` ou redireciona; sidebar oculta itens sem permissão.

## AC-013: Progress 0-100 e responsible obrigatório em waiting_client

- Given: tarefa na etapa `waiting_client`
- When: `responsible` vazio ou `waiting_on_client` falso
- Then: validação rejeita (`required`); progresso derivado = 60.

## AC-014: Migração aditiva preserva dados e deriva stage/progress

- Given: banco existente com tarefas (`Backlog`, `Em Progresso`, etc.)
- When: migração `updateTaskStageProgress` executa
- Then: campo `stage` e `progress` criados; valores derivados de `column`; dados existentes não alterados (aditivo); `updatedAt` atualizado.

## AC-020: N8n — Integração Funcional Ponta a Ponta (GWG Portal)

- Given: `N8N_URL` configurado (`http://127.0.0.1:5679`) e `N8N_API_KEY` presente.
- When: `listN8nWorkflows` (mock de `fetch` global)
- Then: envia `GET` para `http://127.0.0.1:5679/api/v1/workflows`, retorna `N8nWorkflow[]`, header `X-N8N-API-KEY` presente quando configurado. **Teste: `n8n-http.test.ts`**.

- Given: workflow existente com `id: 42`
- When: `getN8nWorkflow(42)`
- Then: envia `GET` para `/api/v1/workflows/42` e retorna `N8nWorkflow`. **Teste: `n8n-http.test.ts`**.

- Given: payload `{name: "Teste GWG"}`
- When: `createN8nWorkflow(payload)`
- Then: envia `POST` para `/api/v1/workflows` com `Content-Type: application/json` e retorna `N8nWorkflow`. **Teste: `n8n-http.test.ts`**.

- Given: `updateN8nWorkflow(42, {name: "Atualizado"})`
- When: `PUT /api/v1/workflows/42`
- Then: retorna `N8nWorkflow` atualizado. **Teste: `n8n-http.test.ts`**.

- Given: `deleteN8nWorkflow(42)`
- When: `DELETE /api/v1/workflows/42`
- Then: `res.ok` e retorna `void`. **Teste: `n8n-http.test.ts`**.

- Given: usuário do portal (`email`, `name`) autenticado via cookie `geos_session`
- When: `provisionN8nUserFn()` chamado (POST `/rest/register` porta 3456, ou via `n8nFetch` corrigido)
- Then: usuário criado no SQLite n8n (bcrypt hash) com `firstName`, `lastName`, `email`, `roleSlug` (`global:member` ou `global:admin`). **Teste: `provision-n8n-user.test.ts`**.

- Given: login no n8n com conta do portal (`email` existente em `users` do Postgres portal, `password_hash` PHC argon2id com pepper `AUTH_PEPPER`)
- When: `email.auth-handler.js` executa `verifyArgon2id`
- Then: retorna `true` quando senha e pepper estão corretos; retorna usuário n8n (criado se não existir). **Teste: `n8n-login-flow.test.ts` já existente** (verifica parse + verificação argon2id cross-runtime com `@noble/hashes` e `crypto.argon2Sync`).

- Given: `N8N_PUBLIC_URL` configurado (`https://...`)
- When: página `/automacoes` carrega `getN8nInfoFn`
- Then: `iframe src` aponta para `publicUrl` (HTTPS). Se o container n8n permite frames (`X-Frame-Options` e CSP compatíveis) e cookies `Secure`/`SameSite` estão configurados, o iframe abre. **Documentado no relatório** (não testável por mock de fetch, mas verificado manualmente).

- Given: `REGISTRATION_CODE` = `GEOS2026` (não alterado)
- When: `registerFn` é chamado com `code: "GEOS2026"`
- Then: cadastro aceito (se não houver admin, usuário torna-se admin). **Não alterado**.

## AC-021: Persistência / Diagnóstico

- Given: `STORAGE_REQUIRE_PERSISTENT=1`
- When: `getStorage()` e nenhum driver persistente abre
- Then: lança erro com mensagem de diagnóstico

- Given: runtime normal
- When: `storageDiagnosticFn`
- Then: retorna `env`, `postgresOpenError`, `tursoOpenError`, `storage` (kind, persistent, path, initError)

## AC-022: Login Logger

- Given: tentativa de login (sucesso ou falha)
- When: `logLoginAttempt`
- Then: arquivo `logs/login-attempts.jsonl` contém linha JSONL com `ts`, `email`, `ip`, `outcome`

## AC-023: Avatar (Foto de Perfil)
- Given: usuário autenticado com `avatarUrl: null`
- When: seleciona arquivo PNG válido (`data:image/png;base64,...`) e clica "Salvar perfil"
- Then: `updateProfileFn` retorna `ok: true`, `avatarUrl` persistido no banco, `PublicUser` atualizado, `audit` registrado com `"Perfil atualizado"`.

- Given: usuário com `avatarUrl` existente
- When: clica "Remover foto" e "Salvar perfil"
- Then: `avatar_url` definido como `NULL` no banco, `avatarUrl` removido de `PublicUser`, preview removido na UI.

- Given: arquivo com payload > 1.5MB
- When: seleciona arquivo e tenta salvar
- Then: `toast.error` com mensagem de limite, `avatarUrl` rejeitado pelo zod (`.refine`), nenhuma alteração no banco.

- Given: arquivo com URL `http://...`
- When: envia `avatarUrl: "http://..."`
- Then: zod rejeita (`startsWith("data:image/")` falha), `ok: false`, erro no cliente.

## AC-017: Redesign ZAGGO — Identidade Visual e Componentes

- Given: usuário acessa `/login` deslogado
- When: a página carrega com `createFileRoute("/login")`
- Then: layout em 2 painéis (institucional ~61% / acesso ~39%), logo `zaggo-logo.png` visível, título institucional com destaque azul, painel de acesso com `loginFn` real, seletor PT/EN demonstrativo, **somente** o método tradicional (e-mail + senha) — sem botão de provedor externo —, rodapé "GWG" em negrito.

- Given: usuário autenticado acessa `/`
- When: `Index` carrega com `usePortalData`, `usePublicUsers`, `useSession`, `useAuditList`
- Then: H1 único `"Acompanhamento do seu projeto"`; saudação com nome real (`useSession`); 6 KPIs (`StatCard`) com valores derivados de `tasks`/`modules`/`milestones`/`risks`; Progresso com `DonutChart` (`done/total`); Próximas Entregas com `StatusTag` real; Equipe com `Avatar` e dados `PublicUser`; Últimas Atualizações com `formatAuditTime`/`formatAuditActor`; Pontos de atenção com riscos reais + aprovações pendentes; ActionBar com links reais (`/tarefas`, `/engenharia`) e botões demonstrativos (`alert`).

- Given: `AppSidebar` renderiza
- When: usuário logado ou deslogado
- Then: logo da marca no topo (`/zaggo-mark.png`) ao lado do nome **"GRUPO GWG"**; todos os itens de navegação preservados (Painel, Tarefas, Automações, Diário, Compliance, Wiki, Riscos, Engenharia, Perfil, Auditoria, Termos, LGPD, Admin); item ativo com fundo `#0868D7`; base com texto "Solução desenvolvida pelo GWG — GEOCIÊNCIAS APLICADAS E TECNOLOGIAS — UFV".

- Given: `src/lib/zaggo-helpers.ts` e testes `zaggo-redesign.test.ts`
- When: `bun run test --run src/server/__tests__/zaggo-redesign.test.ts`
- Then: 12 testes PASS; cálculos `calculateOverallPct`, `countCompletedTasks`, `getNextMilestone`, `mapRoleToArea`, `formatAuditTime` funcionam com dados reais; componentes `StatCard`, `StatusTag`, `Avatar` disponíveis.

## AC-016: Perfil Público e Equipe (Avatar)

- Given: usuário autenticado acessa `/engenharia`
- When: lista usuários públicos (`usePublicUsers`)
- Then: cards exibem `avatarUrl` como `<img>` quando presente, senão `initials`, e são links para `/perfil/$userId`.

- Given: qualquer usuário logado acessa `/perfil/$userId` com `userId` válido
- When: `getPublicUserFn` retorna `PublicUser` com `avatarUrl` e `functions`
- Then: página exibe foto grande, nome, role (`roleLabel`), cargo, depto, bio, e-mail (`mailto:`), badges de funções, botão "Voltar" e breadcrumb.

- Given: usuário logado acessa `/perfil/$userId` com `userId` inexistente
- When: `getPublicUserFn` retorna `ok: false`
- Then: página lança `throw notFound()`.

- Given: usuário vendo seu próprio perfil público (`me.id === userId`)
- When: carrega `/perfil/$userId`
- Then: exibe CTA "Editar meu perfil" (`Link to="/perfil"`).

## AC-024: Identidade GWG, login tradicional e fotos em 4:3

- Given: usuário deslogado acessa `/login`
- When: a página renderiza o painel de acesso
- Then: existe **apenas** o formulário tradicional (e-mail + senha) com `loginFn`; não há botão nem ícone de provedor externo (Microsoft) nem divisor "ou"; o import de `Separator` foi removido junto com o bloco.

- Given: qualquer página do portal
- When: o navegador resolve o ícone da aba
- Then: `__root.tsx` declara `icon` → `/favicon.ico` (`sizes="any"`), `icon` PNG → `/favicon-32x32.png` (`32x32`) e `apple-touch-icon` → `/apple-touch-icon.png` (`180x180`); os três arquivos são gerados de `public/zaggo-logo.png` por `npm run brand:assets`.

- Given: `npm run brand:assets`
- When: a arte-mestra `public/zaggo-logo.png` (1254x1254) é lida
- Then: emite `public/zaggo-wordmark.png` (a palavra isolada, sem o rodapé) e `public/zaggo-mark.png` (o monograma, em quadro quadrado preenchido de branco), e deriva deles `favicon.ico` (16/32/48/64) e `apple-touch-icon.png` (180).

- Given: `AppSidebar` (chrome do portal após o login)
- When: a marca é renderizada
- Then: usa `/zaggo-mark.png` (não mais `/logo.jpg`) com o nome **"GRUPO GWG"**; o rodapé exibe "© 2026 GRUPO GWG".

- Given: `publicUser` no servidor (`src/server/auth.ts`)
- When: resolve o `avatarUrl` de um usuário do portal
- Then: `photoForName` delega a `matchTeamPhoto`, que casa o nome com o manifest em ordem de confiança: slug exato → primeiro + último → primeiro nome **único**; nome ambíguo devolve `undefined` (a tela usa as iniciais) em vez de atribuir a foto de outra pessoa; foto enviada pelo próprio usuário tem sempre prioridade.

- Given: `photos:sync` processa as fotos de `public/team/*.png`
- When: a foto não está em 4:3
- Then: é recortada com `cropRect` (mesma geometria de `cropTo43` em `src/lib/photo-frame.ts`, verificado por `photo-frame-sync.test.ts`); foto já em 4:3 não é reprocessada, então rodar o script várias vezes não degrada a imagem.

- Given: qualquer foto renderizada no portal (painel, `/equipe`, `/perfil`, `/perfil/$userId`, timeline, wiki)
- When: o componente monta a moldura
- Then: a proporção é 4:3 via `PHOTO_ASPECT_CSS` (`aspect-[4/3]`) com `object-cover`, e as classes definem **apenas a altura** (`h-*`), porque `size-*` fixaria as duas dimensões e anularia o `aspect-ratio`; avatares não são mais circulares.

- Given: usuário envia uma foto em `/perfil`
- When: o canvas processa o arquivo
- Then: `cropTo43(img.width, img.height)` define a região de origem **antes** de escalar para no máximo 512px, preservando o headroom (`HEADROOM = 0.3`) para não cortar a linha do cabelo; o resultado é salvo já em 4:3.
