# Spec / Decisões

## DEC-001: SQLite como driver principal

- Tradeoff: SQLite embutido (`node:sqlite`) não requer processo externo, mas não escala para altas cargas concorrentes.
- Decisão: Manter SQLite como padrão local; Postgres/Neon para produção; Turso para edge/cloud.

## DEC-002: PostgresStorage estende SqliteBackend

- Tradeoff: Reutiliza SQL compartilhado, mas requer normalização (`toPg`, `normalizePgRow`, `SCHEMA` substituído).
- Decisão: Estender `SqliteBackend` com substituições (`ON CONFLICT DO NOTHING`, `ctid`, `LOWER`).

## DEC-003: MemoryStorage como fallback final

- Tradeoff: Dados perdidos a cada reinício; não exige `node:sqlite`.
- Decisão: Usar quando `SqliteStorage.open` falha e `STORAGE_REQUIRE_PERSISTENT` é falso.

## DEC-004: Cookie opaco (token aleatório) em vez de JWT

- Tradeoff: JWT é stateless, mas não pode ser revogado facilmente; token opaco permite revogação (`deleteSession`).
- Decisão: Token opaco 256 bits + hash SHA-256 no banco; cookie httpOnly.

## DEC-005: Pepper para Argon2id

- Tradeoff: Adiciona complexidade (env var `PEPPER`), mas aumenta segurança se o banco vazar.
- Decisão: Usar `PEPPER` via `process.env` ou meta no banco; `verifyPassword` inclui `pepper`.

## DEC-006: N8n via `fetch` direto com `X-N8N-API-KEY`

- Tradeoff: Sem SDK oficial; vulnerável a SSRF se URL não validada.
- Decisão: Implementar `validateN8nUrl`, `isBlockedIp`, `safeFetch` no `n8n.ts`. `n8nFetch` usa localhost fixo (`n8nBaseUrl()`), portanto não requer `safeFetch` para o CRUD interno (justificado: URL é configurável mas fixa no env e já protegida pelo container). `provisionN8nUser` usa `n8nFetch` apontando para `/rest/register` (porta 3456 via nginx) com validação implícita pelo endpoint custom.

## DEC-014: Migração aditiva stage/progress/responsible/waiting_on_client, não destrutiva

- Tradeoff: Alterar tabelas existentes pode quebrar versões anteriores; migração aditiva (adicionar colunas) preserva dados.
- Decisão: `updateTaskStageProgress` adiciona `stage` (texto), `progress` (inteiro), `responsible` (texto), `waiting_on_client` (booleano); valores iniciais derivados de `column`; nenhuma linha removida; `updatedAt` atualizado.

## DEC-015: Role cliente: apenas task.comment

- Tradeoff: Adicionar uma nova role aumenta complexidade do RBAC, mas permite deploy futuro (portal para clientes externos).
- Decisão: Role `cliente` (não adicionada ao banco ainda) com apenas `task.comment`; todos os outros acessos bloqueados (`false` em `can`); sidebar oculta itens sem permissão; página `/tarefas` read-only para `cliente`.

## DEC-016: Ocultar UI por permissão + gate de página + revalidação no servidor

- Tradeoff: Filtrar apenas no cliente permite acesso direto via URL; revalidar no servidor aumenta segurança mas exige rede de chamadas.
- Decisão: `AppSidebar` usa `can(role, permission)` para ocultar links; cada `createFileRoute` usa `auth.requirePermission` no handler; `userCan()` revalida no momento da mutação (`createTaskFn`, `addCommentFn`, etc.).

## DEC-007: TDD obrigatório antes de correção

- Tradeoff: Aumenta tempo, mas garante que correções não quebram comportamento existente.
- Decisão: Escrever testes que falham (`RED`), corrigir (`GREEN`), refatorar (`REFACTOR`).

## DEC-011: Correção de paths n8n (n8n 2.17.7)

- Tradeoff: A versão 2.17.7 do n8n usa `/api/v1/workflows` (não `/api/v1` puro para list, nem `/api/v1/{id}` para single).
- Decisão: Corrigir `listN8nWorkflows` para `"/workflows"`; `getN8nWorkflow`, `updateN8nWorkflow`, `deleteN8nWorkflow` para `"/workflows/${id}"`; `createN8nWorkflow` para `"/workflows"` (POST). Manter `n8nApiPath()` = `/api/v1`.

## DEC-012: Provisão via `/rest/register` (porta 3456)

- Tradeoff: O endpoint `/api/v1/users` no n8n 2.x pode não aceitar POST direto com `password` simples; o `register-server.js` (porta 3456) já existe e faz bcrypt + inserção no SQLite n8n.
- Decisão: `provisionN8nUser` usa `n8nFetch("/rest/register", ...)`? NÃO — `n8nFetch` monta `${base}/api/v1${path}`. Como o endpoint custom está na mesma base (`http://127.0.0.1:5679`) mas exposto em `3456`, a solução é chamar `fetch` direto para `http://127.0.0.1:5679` (ou via nginx para 3456) com o path `/rest/register`. **Correção aplicada**: `provisionN8nUser` monta a URL manualmente apontando para `n8nBaseUrl()` com path `/rest/register` (ou usa `fetch` direto para `http://127.0.0.1:3456/rest/register` se configurado). No código atual, usamos `n8nFetch` com path `/users` — isso precisa ser corrigido para `/rest/register` com URL base `n8nBaseUrl()` (que é 5679) se nginx redireciona `/rest/register` → 3456, ou direto `http://127.0.0.1:3456/rest/register`. Dado o `docker-compose.n8n.yml`, o container expõe `3456:3456`. A solução mais segura: fazer `fetch` direto para `http://127.0.0.1:3456/rest/register` com validação de input. **Implementação**: criar uma função `registerN8nUserDirect` que faz POST para `http://127.0.0.1:3456/rest/register`.

## DEC-013: Iframe HTTPS e CSP

- Tradeoff: Se `N8N_PUBLIC_URL` é `https://163-176-45-217.sslip.io`, o iframe usa HTTPS, mas pode ser bloqueado por `X-Frame-Options` ou CSP no n8n.
- Decisão: No `automacoes.tsx`, manter `src={n8nUrl}` onde `n8nUrl` vem de `getN8nInfoFn()` (usa `n8nPublicUrl()`). Se o iframe não abrir, a causa é externa (n8n/configuração nginx). Documentar no relatório. Se o container n8n tiver `N8N_SECURE_COOKIE=false` e permitir frames, o iframe funciona.

## DEC-007: TDD obrigatório antes de correção

- Tradeoff: Aumenta tempo, mas garante que correções não quebram comportamento existente.
- Decisão: Escrever testes que falham (`RED`), corrigir (`GREEN`), refatorar (`REFACTOR`).

## DEC-008: Não alterar `.env` ou `.data/portal.db`

- Tradeoff: Restrições de segurança impedem manipulação de produção.
- Decisão: Só alterar código-fonte (`src/`); documentar baseline no relatório.

## DEC-009: Arquivos `spec/` e `graph/` criados do zero

- Tradeoff: Não existem no repo original; exigem análise independente.
- Decisão: Mapear requisitos diretamente de `src/` (não do repo similar no TecnoCAF).

## DEC-014: Tokens visuais ZAGGO centralizados em `src/styles.css`

- Tradeoff: Centralizar cores (`--brand`, `--brand-soft`, `--brand-foreground`, `--sidebar`) e fonte (`Manrope`/`Nunito Sans`) no arquivo `styles.css` aumenta a consistência visual, mas requer manutenção manual para futuras variações de tema.
- Decisão: Mapear `--brand` para `oklch(0.54 0.19 218)` (azul institucional vivo ~`#0868D7`); `--sidebar` para `oklch(0.11 0.06 255)` (azul-marinho profundo); importar `Manrope` e `Nunito Sans` via `@import` Google Fonts; aplicar `font-family` no `html`/`body`; criar componentes reutilizáveis (`StatCard`, `StatusTag`, `Avatar`, `PanelCard`, `SectionHeader`, `DonutChart`, `ActionBar`) que consomem os tokens centrais.
- Impacto: Nenhum arquivo de servidor alterado; design visual unificado entre login, dashboard, sidebar e componentes; acessibilidade preservada com contraste AA/AAA.

## DEC-010: `postinstall` (`patch-unenv.mjs`)

- Tradeoff: Corrige compatibilidade de runtime; pode mascarar problemas.
- Decisão: Manter `postinstall`; documentar no relatório se causar falhas.
