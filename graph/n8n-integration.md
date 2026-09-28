# Graph — Integração n8n (GWG Portal)

## Fluxo de Requisição

```
Portal (React / automacoes.tsx)
  │ iframe src = n8nPublicUrl()  (HTTPS)
  │ links = n8nUrl + "/workflow/" + id
  │
  ▼
Portal API (portal-api.ts)
  │ createServerFn (POST / GET)
  │
  ▼
src/server/n8n.ts
  │ n8nFetch(path, init) → base (http://127.0.0.1:5679) + /api/v1 + path
  │ n8nBaseUrl()  → env N8N_URL ou fallback 127.0.0.1:5679
  │ n8nPublicUrl() → env N8N_PUBLIC_URL ou base
  │ n8nApiKey()    → env N8N_API_KEY
  │
  ├── listN8nWorkflows → GET /api/v1/workflows
  ├── getN8nWorkflow(id) → GET /api/v1/workflows/{id}
  ├── createN8nWorkflow(payload) → POST /api/v1/workflows
  ├── updateN8nWorkflow(id, payload) → PUT /api/v1/workflows/{id}
  ├── deleteN8nWorkflow(id) → DELETE /api/v1/workflows/{id}
  └── provisionN8nUser(email, name, password) → POST /rest/register (porta 3456 via nginx ou direto)
  │
  ▼
nginx (VM: 163-176-45-217.sslip.io → 3001 / 5679 / 3456)
  │ proxy_pass para container n8n-recipe
  │
  ├── 5679 → n8n (container, porta interna 5678)
  │    └── /api/v1/* → n8n API
  │    └── /rest/login → email.auth-handler.js (fallback portal)
  │    └── /rest/register → register-server.js (porta 3456 exposta)
  └── 3456 → register-server.js (criação direta no SQLite n8n com bcrypt)
  │
  ▼
n8n-recipe (container Docker)
  │ imagem: n8n-custom-geos:latest (base n8nio/n8n:2.17.7)
  │ volume: n8n_recipe_data (SQLite .n8n/database.sqlite)
  │
  ├── SQLite n8n (database.sqlite)
  │    └── tabela user (email, firstName, lastName, password [bcrypt], roleSlug, disabled)
  │    └── tabela workflow (workflows do usuário)
  │
  └── email.auth-handler.js (patch injetado)
       └── login portal → busca Postgres portal (users.password_hash argon2id + AUTH_PEPPER)
       └── se válido → retorna/cria usuário n8n (bcrypt hash) com roleSlug mapeado

Postgres Portal (VM: 163.176.45.217:5433, DB: portal)
  │ tabela users
  │    ├── email, name, role, password_hash (PHC argon2id), password_salt (hex)
  │    └── hash gerado por src/server/passwords.ts (@noble/hashes/argon2)
  │ tabela automation_shares (persistência própria)
  │
  ▼
Fonte de Auth: cookie `geos_session` (token opaco 256 bits, SHA-256 no banco)
Header n8n: `X-N8N-API-KEY` (env N8N_API_KEY)

## Caminhos Esperados com Headers

| Operação | Método | Path Completo | Headers | Origem Auth |
|-----------|--------|---------------|---------|-------------|
| list workflows | GET | `http://127.0.0.1:5679/api/v1/workflows` | `X-N8N-API-KEY`, `Content-Type` | Env (`N8N_API_KEY`) |
| get workflow | GET | `.../api/v1/workflows/{id}` | `X-N8N-API-KEY` | Env |
| create workflow | POST | `.../api/v1/workflows` | `X-N8N-API-KEY`, `Content-Type: application/json` | Env |
| update workflow | PUT | `.../api/v1/workflows/{id}` | `X-N8N-API-KEY`, `Content-Type: application/json` | Env |
| delete workflow | DELETE | `.../api/v1/workflows/{id}` | `X-N8N-API-KEY` | Env |
| provision (custom) | POST | `http://127.0.0.1:3456/rest/register` | `Content-Type: application/json` | Nenhum (endpoint aberto no container) |
| login n8n (portal fallback) | POST | `/rest/login` (n8n) | `Content-Type: application/json`, cookie `geos_session` | Cookie portal |

## Observações de Segurança
- `n8nFetch` (localhost fixo) não requer `safeFetch`/`validateN8nUrl` (URL é interna e controlada pelo env/container).
- Se `N8N_URL` for alterado para domínio externo, `n8nFetch` deve ser substituído por `safeFetch` com `validateN8nUrl`.
- `BLOCKED_NETWORKS` protege SSRF se algum componente tentar redirecionar para redes privadas.
```
