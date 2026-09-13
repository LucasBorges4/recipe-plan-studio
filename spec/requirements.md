# Spec / Requisitos — Portal de Governança Grupo Geos

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

## REQ-011: Convites e Reset de Senha
- Funcionalidade: Convites (`InviteRow`), tokens de reset (`ResetToken`).
- Interfaces: `Storage.insertInvite`, `Storage.getInviteByHash`, `Storage.insertResetToken`, `Storage.getResetTokenByHash`.
- Drivers: SQLite, Postgres.

## REQ-012: Auditoria (Audit Trail)
- Funcionalidade: Registro de ações (`AuditEntry`).
- Interfaces: `Storage.insertAudit`, `Storage.listAudit`, `Storage.countAudit`.
- Drivers: SQLite, Postgres.

## REQ-013: Integração n8n
- Funcionalidade: Listar/criar/atualizar/excluir workflows n8n; provisionar usuários; compartilhar workflows.
- Interfaces: `n8nFetch`, `listN8nWorkflows`, `createN8nWorkflow`, `updateN8nWorkflow`, `deleteN8nWorkflow`, `provisionN8nUser`.
- Drivers: HTTP (`fetch`) para `N8N_URL` (padrão `http://127.0.0.1:5679`).

## REQ-014: Persistência e Diagnóstico
- Funcionalidade: Inicialização automatizada (`getStorage`, `initStorage`), diagnóstico de persistência (`storageDiagnosticFn`), migrações (`SCHEMA`).
- Interfaces: `Storage.getStorageInfo`, `getStorageInitError`.
- Drivers: SQLite (`.data/portal.db`), Postgres (`POSTGRES_URL`), Turso (`TURSO_DATABASE_URL`), D1 (binding), Memória.

## REQ-015: Login Logger
- Funcionalidade: Registro de tentativas de login (`LoginLogEntry`) em arquivo JSONL.
- Interfaces: `logLoginAttempt`.
- Drivers: Sistema de arquivos (`node:fs`).

## REQ-016: Diagnóstico em Runtime
- Funcionalidade: Endpoint `storageDiagnosticFn` expõe estado real de storage, env vars e erros de abertura.
- Interfaces: `getStorage`, `isStoragePersistent`, `getActiveDatabasePath`.
- Drivers: Runtime (Node / Edge).
