# Spec / Arquitetura

## Stack
- Frontend: React 19 + TanStack Start (router, start, query)
- Backend: Nitro / TanStack server functions (`createServerFn`)
- Persistência: SQLite (`node:sqlite`), Postgres (`pg` / Neon), Turso (`@libsql/client`), D1 (Cloudflare), Memória
- Autenticação: Cookie `geos_session` (token opaco 256 bits, SHA-256 no banco)
- Hash: Argon2id (`@noble/hashes`) + pepper (`PEPPER`)
- Type System: TypeScript 5.8
- Testes: Vitest
- Build: Vite + TypeScript

## Interfaces Principais

### Storage (`src/server/storage.ts`)
- `Storage`: interface unificada para todos os drivers.
- `SqliteBackend`: base abstrata com SQL compartilhado.
- `MemoryStorage`: armazenamento volátil em memória.
- `SqliteStorage`: arquivo persistente (`.data/portal.db`) ou memória (`:memory:`).
- `D1Storage`: binding Cloudflare D1.
- `PostgresStorage`: Neon / Postgres via `pg` ou `@neondatabase/serverless`.

### Auth (`src/server/auth.ts`)
- `createSession`, `destroyCurrentSession`, `getCurrentUser`, `requireUser`, `requirePermission`.
- `publicUser`, `publicUserWithFunctions`.

### N8n (`src/server/n8n.ts`)
- `n8nFetch`: fetch com header `X-N8N-API-KEY`.
- `listN8nWorkflows`, `getN8nWorkflow`, `createN8nWorkflow`, `updateN8nWorkflow`, `deleteN8nWorkflow`.
- `provisionN8nUser`: cria usuário no n8n (email, firstName, lastName, password, role).

### Portal API (`src/lib/portal-api.ts`)
- `createServerFn` para cada operação (register, login, logout, tasks, etc.).
- `expectedRegistrationCode`: lê `REGISTRATION_CODE` / `INVITE_CODE` / `CADASTRO_CODE`.

### Contexto (`src/server/context.ts`)
- `serverCtx`: retorna `storage`, `auth`, `pw`, `pepper`, `newId`, `logAudit`.

### Drivers e Fallback
1. Postgres (`POSTGRES_URL`)
2. Turso (`TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`)
3. D1 (binding injetado)
4. SQLite arquivo (`DATABASE_PATH` ou `.data/portal.db`)
5. SQLite memória (`:memory:`)
6. Memória (`MemoryStorage`)

## Componentes Críticos
- `Storage` → todos os módulos de negócio
- `SqliteBackend` → `SqliteStorage`, `D1Storage`, `PostgresStorage`
- `MemoryStorage` → fallback quando `node:sqlite` não está disponível
- `PostgresStorage` → usa `SCHEMA` com substituições (`INSERT OR IGNORE` → `ON CONFLICT DO NOTHING`, `rowid` → `ctid`)
