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

### N8n (`src/server/n8n.ts`) — Contratos exatos (GWG Portal)

- `n8nBaseUrl()`: `process.env.N8N_URL` → fallback `http://127.0.0.1:5679`.
- `n8nPublicUrl()`: `process.env.N8N_PUBLIC_URL` → fallback `n8nBaseUrl()`.
- `n8nApiPath()`: retorna `"/api/v1"`.
- `n8nFetch(path, init)`: monta `"${base}${n8nApiPath()}${path}"` com header `X-N8N-API-KEY` quando `n8nApiKey()` retorna valor. NÃO valida URL (localhost fixo é seguro por definição). Quando a URL é configurável (externa), deve usar `safeFetch` com `validateN8nUrl`.
- Paths corretos (n8n 2.17.7):
  - `listN8nWorkflows`: `n8nFetch("")` → `GET /api/v1/workflows` (o endpoint real é `/workflows`, mas `n8nFetch` monta `${base}/api/v1` + `""` = `/api/v1` → precisa corrigir para `n8nFetch("/workflows")` ou ajustar `n8nFetch` para incluir `/workflows` quando vazio). **Correção aplicada**: `listN8nWorkflows` usa `n8nFetch("/workflows")`; `getN8nWorkflow(id)` usa `n8nFetch("/workflows/${id}")`; `createN8nWorkflow` usa `n8nFetch("/workflows", {method:"POST"...})`; `updateN8nWorkflow(id)` usa `n8nFetch("/workflows/${id}", {method:"PUT"...})`; `deleteN8nWorkflow(id)` usa `n8nFetch("/workflows/${id}", {method:"DELETE"...})`.
- `provisionN8nUser(email, name, password)`: usa endpoint custom `/rest/register` (porta 3456, nginx proxy) para criar usuário direto no SQLite n8n com bcrypt (`register-server.js`). Senha temporária: `Temp12345!` (sem log persistente de segredo). Corpo POST: `{email, password, firstName, lastName}`.
- `getN8nInfoFn`: retorna `{url: base, publicUrl, hasApiKey}`. `publicUrl` usado para `iframe src` em `automacoes.tsx`.
- Iframe embarcado: `src={n8nUrl}` onde `n8nUrl = n8nInfo?.publicUrl ?? ...`. Se `N8N_PUBLIC_URL` está configurado (`https://163-176-45-217.sslip.io`), o iframe aponta para HTTPS. Se não houver CSP/X-Frame-Options bloqueante no n8n e o cookie `Secure`/`SameSite` estiver compatível, o iframe abre normalmente.
- Login portal→n8n: `email.auth-handler.js` consulta `users` no Postgres portal (`password_hash`, `password_salt`), parse `PHC` (`$argon2id$v=19$m=19456,t=2,p=1$`), verifica com `crypto.argon2Sync` usando `AUTH_PEPPER`. Se válido e usuário não existe no SQLite n8n, cria com `bcryptjs` hash (`password` do portal) e mapeia role (`admin` → `global:admin`, outros → `global:member`).

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
