# Spec / Requisitos — Portal de Governança GWG — Grupo W. Geotec

## REQ-001: Autenticação e Sessão

- Funcionalidade: Login, registro, logout, sessão persistente (cookie httpOnly).
- Interfaces: `Storage.getUserByEmail`, `Storage.insertSession`, `auth.createSession`.
- Drivers: SQLite (`SqliteStorage`), D1 (`D1Storage`), Memória (`MemoryStorage`), Postgres (`PostgresStorage`).

## REQ-002: Cadastro de Usuário com Código

- Funcionalidade: Registro com `REGISTRATION_CODE` ou convite (`invite`); auto-heal de admin.
- Interfaces: `Storage.insertUser`, `Storage.getInviteByHash`, `Storage.insertInvite`.
- Drivers: SQLite, Postgres.

## REQ-003: RBAC e Funções Concedidas

- Funcionalidade: Papéis (`admin`, `diretor`, `gestor`, `desenvolvedor`, `auditor`); funções individuais (`grantUserFunction`).
- Interfaces: `Storage.listRoleFunctions`, `Storage.grantUserFunction`, `Storage.listUserFunctions`.
- Drivers: SQLite, Postgres.

## REQ-004: Tarefas (Kanban)

- Funcionalidade: Criar, listar, mover entre colunas (`Backlog`, `Em andamento`, `Concluído`), excluir.
- Interfaces: `Storage.insertTask`, `Storage.updateTaskColumn`, `Storage.listTasks`.
- Drivers: SQLite, Postgres.

## REQ-005: Comentários em Tarefas

- Funcionalidade: Adicionar comentários vinculados a tarefas.
- Interfaces: `Storage.insertComment`, `Storage.listComments`.
- Drivers: SQLite, Postgres.

## REQ-006: Controles de Compliance

- Funcionalidade: Cadastro de controles (`ComplianceControl`), revisão, evidências (`EvidenceRecord`).
- Interfaces: `Storage.insertControl`, `Storage.reviewControl`, `Storage.insertEvidence`, `Storage.reviewEvidence`.
- Drivers: SQLite, Postgres.

## REQ-007: Documentos e Wiki

- Funcionalidade: Artigos wiki (`WikiArticle`), documentos legais (`LegalDoc`), docs genéricos (`DocRecord`).
- Interfaces: `Storage.insertWiki`, `Storage.insertLegalDoc`, `Storage.upsertDoc`.
- Drivers: SQLite, Postgres.

## REQ-008: Riscos

- Funcionalidade: Cadastro, atualização, exclusão de riscos; geração automática (`generateAutoRisksFn`).
- Interfaces: `Storage.insertRisk`, `Storage.updateRisk`, `Storage.listRisks`.
- Drivers: SQLite, Postgres.

## REQ-009: Módulos, Milestones, Releases, Patentes, Stack

- Funcionalidade: Gerenciar módulos, marcos, releases, estágios de patente, stack técnico.
- Interfaces: `Storage.insertModule`, `Storage.insertMilestone`, `Storage.insertRelease`, `Storage.insertPatentStage`, `Storage.insertTechStack`.
- Drivers: SQLite, Postgres.

## REQ-010: Automação e Próximos Passos

- Funcionalidade: Compartilhamento de automações (`AutomationShare`), passos (`NextStep`).
- Interfaces: `Storage.upsertAutomationShare`, `Storage.insertNextStep`, `Storage.reorderNextSteps`.
- Drivers: SQLite, Postgres.

## REQ-011: Tarefas com 5 etapas + atributos stage/progress/responsible/waiting_on_client

- Funcionalidade: Tarefas possuem 5 etapas (`not_started`, `in_progress`, `waiting_client`, `review`, `done`) com rótulos PT-BR; progresso 0-100 derivado da etapa; campo `responsible` obrigatório quando `waiting_client`; `waiting_on_client` booleano derivado.
- Interfaces: `task-stages.ts` (`CLIENT_STAGES`, `stageLabel`, `stageTone`, `columnToStage`, `stageToColumn`, `inferProgressFromStage`, `isWaitingOnClient`).
- Drivers: Helper puro, sem persistência.

## REQ-012: Role Cliente com visibilidade restrita + comentar

- Funcionalidade: Role `cliente` (fictícia para testes/deploy futuro) com visibilidade restrita: vê apenas `Acompanhamento` (tarefas read-only) e pode comentar (`task.comment`); bloqueado em automações/admin/auditoria/compliance/etc.
- Interfaces: `RBAC.matrix` (se adicionada), `userCan`, `getEffectivePermissions`.
- Drivers: Client-side gate (`permission`) + server-side revalidação.

## REQ-013: Filtro de páginas por permissão e sidebar

- Funcionalidade: Cada página (`/tarefas`, `/automacoes`, `/admin`, etc.) filtra por permissão no cliente (`sidebar`) e revalida no servidor (`requirePermission`); itens sem permissão ocultos; acesso direto retorna erro ou redireciona.
- Interfaces: `AppSidebar`, `createFileRoute`, `auth.requirePermission`.
- Drivers: React Router + TanStack Start SSR.

## REQ-014: Convites e Reset de Senha

- Funcionalidade: Convites (`InviteRow`), tokens de reset (`ResetToken`).
- Interfaces: `Storage.insertInvite`, `Storage.getInviteByHash`, `Storage.insertResetToken`, `Storage.getResetTokenByHash`.
- Drivers: SQLite, Postgres.

## REQ-015: Auditoria (Audit Trail)

- Funcionalidade: Registro de ações (`AuditEntry`).
- Interfaces: `Storage.insertAudit`, `Storage.listAudit`, `Storage.countAudit`.
- Drivers: SQLite, Postgres.

## REQ-016: Integração n8n (GWG Portal — ponta a ponta)

- Funcionalidade: Listar (`GET /api/v1/workflows`), criar (`POST /api/v1/workflows`), atualizar (`PUT /api/v1/workflows/{id}`), excluir (`DELETE /api/v1/workflows/{id}`) workflows n8n; provisionar usuário (`POST /rest/register` porta 3456); compartilhar workflows (`AutomationShare`); iframe HTTPS embarcado (`n8nPublicUrl()`); login portal→n8n com fallback argon2id (`AUTH_PEPPER`).
- Interfaces: `n8nFetch` (base + `/api/v1` + path correto: `/workflows` ou `/workflows/{id}`), `listN8nWorkflows`, `getN8nWorkflow`, `createN8nWorkflow`, `updateN8nWorkflow`, `deleteN8nWorkflow`, `provisionN8nUser` (target endpoint `/rest/register` via nginx 3456), `getN8nInfoFn` (publicUrl para iframe).
- Drivers: HTTP (`fetch`) para `N8N_URL` (`http://127.0.0.1:5679`) e `N8N_PUBLIC_URL` (`https://163-176-45-217.sslip.io`); `X-N8N-API-KEY` obrigatório quando configurado; `validateN8nUrl`/`safeFetch` para SSRF; `email.auth-handler.js` faz fallback no Postgres portal com argon2id (salt hex + hash b64) e pepper `AUTH_PEPPER`; `register-server.js` (porta 3456) cria usuário direto no SQLite n8n com bcrypt.
- Restrições: NÃO alterar `REGISTRATION_CODE` (`GEOS2026`); NÃO expor `AUTH_PEPPER`; NÃO modificar `.env` ou `.data/`. Manter identidade GWG.

## REQ-017: Persistência e Diagnóstico

- Funcionalidade: Inicialização automatizada (`getStorage`, `initStorage`), diagnóstico de persistência (`storageDiagnosticFn`), migrações (`SCHEMA`).
- Interfaces: `Storage.getStorageInfo`, `getStorageInitError`.
- Drivers: SQLite (`.data/portal.db`), Postgres (`POSTGRES_URL`), Turso (`TURSO_DATABASE_URL`), D1 (binding), Memória.

## REQ-018: Login Logger

- Funcionalidade: Registro de tentativas de login (`LoginLogEntry`) em arquivo JSONL.
- Interfaces: `logLoginAttempt`.
- Drivers: Sistema de arquivos (`node:fs`).

## REQ-019: Diagnóstico em Runtime

- Funcionalidade: Endpoint `storageDiagnosticFn` expõe estado real de storage, env vars e erros de abertura.
- Interfaces: `getStorage`, `isStoragePersistent`, `getActiveDatabasePath`.
- Drivers: Runtime (Node / Edge).
