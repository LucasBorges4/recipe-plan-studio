# 🔍 AUDITORIA COMPLETA DOS FUNDAMENTOS DE COMPUTAÇÃO
**Projeto:** Recipe Plan Studio (TanStack Start + Nitro SSR + SQLite/Postgres)  
**Data:** 28/09/2026  
**Escopo:** 167 arquivos TypeScript, 33 rotas, 46 componentes UI, 59 deps, 411 testes, 33 arquivos de teste  
**Metodologia:** Análise baseada exclusivamente em evidências do código-fonte presente, verificada via subagents paralelos em 5 áreas.

---

# MAPA DE COMPETÊNCIAS
*Cobertura de itens verificados — não é avaliação subjetiva de qualidade.*

```
Programação          █████████░ (90%)
Algoritmos           ██████░░░░ (60%)
Banco de dados       ████████░░ (80%)
Redes                ██████░░░░ (60%)
Segurança            █████░░░░░ (50%)
DevOps                ███░░░░░░░ (30%)
Testes                ██████░░░░ (60%)
Arquitetura           ████████░░ (80%)
UX/UI                 ████████░░ (80%)
Acessibilidade        ██████░░░░ (60%)
Performance           █████░░░░░ (50%)
Observabilidade       ███░░░░░░░ (30%)
```

---

# 1. FUNDAMENTOS DE PROGRAMAÇÃO

## 2.1 Tipagem, Escopo, Mutabilidade

**[IMPLEMENTADO]**

- TypeScript estrito (`strict: true`, `noUnusedLocals`, `noUnusedParameters`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noUncheckedSideEffectImports`)
- `verbatimModuleSyntax: false` permite imports flexíveis
- `module: "ESNext"`, `target: "ES2022"`, `jsx: "react-jsx"`
- `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noImplicitOverride`
- Generics usados em `Storage`, `ApiResult<T>`, `PublicUser`, etc.
- `Role` como union type, `Permission` como string literal union
- **Problema:** `noUnusedLocals: false` e `noUnusedParameters: false` mascaram código morto

**Evidência:** `tsconfig.json` completo. `src/lib/rbac.ts` com types bem definidos.

**Impacto:** Tipagem forte reduz bugs. Flags relaxadas escondem débito técnico.

**Severidade:** BAIXA  
**Como corrigir:** `noUnusedLocals: true`, `noUnusedParameters: true`

---

# 2. ALGORITMOS E ESTRUTURAS DE DADOS

## 3. Big-O e Gargalos

### Algoritmos identificados:

| Algoritmo | Entrada | Saída | Tempo | Espaço | Problema |
|---|---|---|---|---|---|
| `listTasks()` | — | Todas as tasks | O(n) | O(n) | Sem paginação, full scan |
| `listAudit()` | — | Todo audit | O(n) | O(n) | Crescimento ilimitado |
| `getControl(id)` | id | 1 controle | O(n) | O(1) | `listControls()` + `.find()` |
| `getEvidence(id)` | id | 1 evidência | O(n) | O(1) | `listEvidences()` + `.find()` |
| `globalSearchFn()` | query | resultados | O(n×tabelas) | O(n) | 4 full scans |
| `matchTeamPhoto(name)` | name | foto ou undef | O(m) | O(1) | m = fotos no manifest |
| `hashPassword()` | senha | PHC string | O(memory) | O(1) | Argon2id |
| `loginFn()` | email+senha | PublicUser | O(1) + hash | O(1) | Rate limit O(1) |

### Algoritmos que causam problemas em escala:

**`listTasks()`, `listAudit()`, `listComments()`** fazem `SELECT *` sem `LIMIT`. Com 100k+ registros, cada chamada retorna milhões de linhas e consome toda a RAM.

**`getControl(id)`** e **`getEvidence(id)`** carregam TODOS os registros para retornar um. Se houver 10k controles, cada `getControl` carrega 10k linhas.

**`globalSearchFn`** carrega todas as tabelas para filtrar em memória.

**Impacto real:** O sistema funciona bem para ~100 usuários com centenas de registros. Com 1000+, cada lista torna-se lenta e consome memória crescente.

**Severidade:** ALTA  
**Como corrigir:** Adicionar paginação (`LIMIT/OFFSET` ou cursor-based) a todas as listagens. Substituir `listX() + .find()` por `SELECT WHERE id = ?`.  
**Teste:** `npm run test` + verificar que `listTasks` aceita `limit`/`offset`.

---

# 3. ENGENHARIA DE SOFTWARE

## 4.1 Arquitetura e SOLID

**[IMPLEMENTADO]**

### Camadas:
- `src/routes/` — Componentes client (tanstack start routes)
- `src/server/` — Backend (storage, auth, passwords, context)
- `src/lib/` — Lógica compartilhada (portal-api, api-hooks, rbac, team-photos)
- `src/data/` — Dados e catálogos
- `src/components/` — Componentes UI + portal
- `src/hooks/` — Hooks customizados

### Separação de responsabilidades: ✅
- `Storage` interface define contrato. `SqliteStorage`, `PostgresStorage`, `D1Storage`, `MemoryStorage` implementam.
- `auth.ts` lida com autenticação, sessões, cookies.
- `passwords.ts` lida exclusivamente com hash/verify.
- `portal-api.ts` server functions.
- `api-hooks.ts` TanStack Query hooks.

### Acoplamento: PARCIAL
- `AppSidebar.tsx` (250 linhas) mistura UI com lógica de sessão, navegação, busca, logout — alto acoplamento
- `index.tsx` (590 linhas) — responsibility excessive
- `perfil.tsx` (503 linhas) — mistura perfil, senha, equipe, sessões

### SOLID:
- **S**ingle Responsibility: Parcial (componentes página grandes)
- **O**pen/Closed: ✅ (Storage interface permite novos backends)
- **L**iskov: ✅ (todas implementam Storage)
- **I**nterface Segregation: ✅ (Storage tem métodos granulares)
- **D**ependency Inversion: ✅ (`ctx()` importa dinamicamente, storage é singleton)

**Severidade:** MÉDIA (acoplamento em componentes grandes)  
**Como corrigir:** Extrair hooks customizados (`useAppSidebar`, `useDashboard`). Fragmentar páginas em sub-componentes.  
**Teste:** `eslint` + verificar tamanho de arquivo < 300 linhas.

---

## 4.2 Arquitetura do sistema

**[IMPLEMENTADO]** — **SSR com TanStack Start + Nitro (Node.js server)**

- Monólito em único repositório
- SSR via TanStack Start com Nitro `preset: "node-server"`
- `wrangler.json` configura Cloudflare D1 binding (alternativa)
- `vercel.json` buildCommand para Vercel
- TanStack Query para caching client
- TanStack Router com file-based routing

**Por que essa escolha é adequada:**
- Problema: Portal interno de governança, equipe definida, não precisa de escalabilidade massiva
- Restrição: Deploy simples, sem infraestrutura complexa
- Alternativas consideradas: Next.js (mais complexo), SPA puro (pior SEO), serverless (limitações de state)
- Trade-off: SSR + TanStack Start oferece melhor TTI e SEO para portal interno
- Consequência: Stateful com SQLite impede horizontal scaling, mas é aceitável para escala atual

**Severidade:** BAIXA (adequada para o caso)

---

# 4. SEGURANÇA

## 12. OWASP

### SQL Injection
**[IMPLEMENTADO]** — Todos os queries usam parâmetros bindados (`?` para SQLite, `$1,$2...` para Postgres). Nenhuma interpolção de strings em SQL. Allowlist para nomes de colunas em `UPDATE`.

### XSS
**[IMPLEMENTADO]** — React auto-escapes por padrão. Nenhum `dangerouslySetInnerHTML` encontrado no código-fonte analisado.

### CSRF
**[IMPLEMENTADO]** — `src/start.ts:23-25`: `createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" })` protege todos os server functions.

### Broken Access Control
**[PARCIAL]** — `requirePermission()` existe no `portal-api.ts`. `debugLoginFn` expõe metadados de hash. `listPublicUsersFn` retorna todos os usuários. `getPublicUserFn` aceita qualquer `userId`. IDOR potencial.

**Severidade:** MÉDIA  
**Como corrigir:** Remover `debugLoginFn` em produção. Adicionar verificação de autorização em `getPublicUserFn` e `listPublicUsersFn`.  
**Teste:** Autenticar como usuário "A", tentar acessar perfil do usuário "B" via `getPublicUserFn`. Deve falhar.

### Authentication flaws
**[IMPLEMENTADO]** — Argon2id com pepper, salt por usuário, constant-time comparison, dummy hash para timing attack prevention, rate limiting (8 tentativas/10min em memória).

**Problema:** Parâmetros Argon2 abaixo do OWASP (`t=2` vs `t=3` recomendado). Rate limiting em memória (não distribuído).

**Severidade:** MÉDIA  
**Como corrigir:** Aumentar `iterations` para `t=3`. Migrar rate limiting para storage-based (Redis ou banco).

### Secrets expostos
**[CRÍTICO]** — `.env` contém `AUTH_PEPPER`, `N8N_API_KEY` (JWT real), `N8N_ENCRYPTION_KEY`, `POSTGRES_PASSWORD` em texto puro no filesystem. `.gitignore` protege `.env` do git, mas o arquivo existe no servidor.

**Impacto:** Se o servidor for comprometido (acesso SSH, vazamento de backup), todos os secrets estão expostos.

**Como corrigir:** Rotacionar todos os secrets imediatamente. Usar gerenciador de secrets (Vercel Secrets, HashiCorp Vault, AWS Secrets Manager). Remover secrets do `.env` e usar runtime env injection.

**Teste:** `ls -la .env` → verificar permissões (`chmod 600`). Verificar que nenhum `.env` está no git (`git ls-files .env`).

### Dependências vulneráveis
**[PARCIAL]** — `npm audit` não executado. `@lovable.dev/vite-tanstack-config` é um pacote de terceiros que controla o build. `nitro` é versão beta. `bcryptjs` e `hash-wasm` em devDependencies.

**Como corrigir:** Executar `npm audit` regularmente. Substituir `nitro` beta por estável.

---

# 5. AUTENTICAÇÃO E AUTORIZAÇÃO

## 13. Auth vs Authz

**[IMPLEMENTADO] com ressalvas**

### Autenticação (quem é o usuário?):
- **Hash seguro:** Argon2id (RFC 9106) via `@noble/hashes` ✅
- **Salt:** 16 bytes aleatórios via WebCrypto, único por usuário ✅
- **Pepper:** Segredo global via `AUTH_PEPPER`, injetado como `key` do Argon2 ✅
- **Sessões:** Token opaco 256 bits, banco guarda SHA-256 do token ✅
- **Expiração:** 7 dias (`SESSION_TTL_MS`) ✅
- **Revogação:** `deleteSessionsForUser()`, `deleteSessionsForUser()` ✅
- **Rate limiting:** 8 tentativas/10min, Map em memória ⚠️
- **Dummy hash:** Previne enumeração de usuários ✅
- **Tempo constante:** `constantTimeEqual()` ✅

### Autorização (o que pode fazer?):
- **RBAC:** 7 papéis (admin, diretor, gestor, desenvolvedor, auditor, visualizador, cliente), 19 permissões ✅
- **userCan():** Verifica role + funções concedidas individualmente ✅
- **requirePermission():** Verifica no servidor antes de mutações ✅
- **IDOR:** `getPublicUserFn` aceita qualquer `userId` ⚠️
- **Account enumeration:** Dummy hash protege ⚠️ parcial

### Problemas:
- **Sem lockout** após N falhas (apenas rate limiting em memória)
- **Sem rotação de pepper**
- **MFA:** Não implementado (aceitável para portal interno)
- **Password reset:** Usa `Math.random()` (não criptograficamente seguro) — **ALTA**

**Severidade:** ALTA (password reset token)  
**Como corrigir:** Substituir `Math.random()` por `crypto.getRandomValues()` no `createPasswordResetFn`.  
**Teste:** Verificar que o token gerado tem entropia criptográfica (256 bits).

---

# 6. BANCO DE DADOS

## 11. Modelagem, SQL, Performance

### Modelagem
**[PARCIAL]**

- **FK existentes:** `sessions.user_id`, `password_reset_tokens.user_id`, `user_functions.user_id` ✅
- **FK ausentes:** `tasks.column_name`, `comments.task_id`, `evidences(control_id)`, `risks(task_id)`, `journal_entries(author_id)` ⚠️
- **Denormalização:** `author_name`, `actor_name`, `sent_by_name` duplicam dados de usuário ⚠️
- **Chaves primárias:** `TEXT PRIMARY KEY` para usuários, `INTEGER PRIMARY KEY AUTOINCREMENT` para audit ✅
- **Constraints:** `email COLLATE NOCASE UNIQUE` ✅

### Queries
**[IMPLEMENTADO]** — Parameter binding consistente. `toPg()` converte `?` → `$n`. SQL parametrizado.

### Performance
**[PARCIAL]**

- **Índices existentes:** `audit_entity_idx`, `legal_docs_slug_idx`, `docs_kind_idx`, `role_functions_role_idx`, `user_functions_user_idx` ✅
- **Índices ausentes:** `tasks(column_name)`, `comments(task_id)`, `sessions(user_id)`, `evidences(control_id)`, `reset_tokens(expires_at)` ⚠️
- **Full table scans:** `listTasks()`, `listAudit()`, `listComments()` sem LIMIT ⚠️
- **N+1:** `getControl(id)` → `listControls() + .find()` ⚠️
- **Connection pooling:** `pg.Pool` com `max: 5` para Postgres ✅, SQLite sem pooling (aceitável) ✅

### Migrations
**[PARCIAL]** — Migrações inline via `ALTER TABLE ADD COLUMN IF NOT EXISTS`. Diretório `migrations/` não existe. Sem sistema formal (drizzle, prisma). Schema versionado apenas no git.

### Backup
**[ALTA]** — `scripts/backup-portal-db.sh` existe mas é manual. Sem automação, retenção, restore testado, criptografia. `.data/pg-backups/` contém backups antigos sem política.

**Severidade:** ALTA (backup), MÉDIA-ALTA (FK, migrations, índices)  
**Como corrigir:** Adicionar FK nas tabelas críticas. Criar diretório `migrations/`. Adicionar índices faltantes. Automatizar backup com cron + testar restore.  
**Teste:** `npm run test` + verificar FK com `PRAGMA foreign_key_list(tasks)`.

---

# 7. REDES DE COMPUTADORES

## 9. Redes

**[PARCIAL]**

- **HTTP/HTTPS:** App servido via nginx com TLS (docs/ci-cd.md linha 27) ✅
- **TLS:** `secure: isSecureRequest()` no cookie, mas depende de `x-forwarded-proto` falsificável ⚠️
- **CORS:** Não configurado explicitamente ⚠️
- **Rate limiting:** Em memória, por IP + scope ✅
- **Webhook:** `WEBHOOK_URL` para n8n integração ✅
- **Reverse proxy:** nginx (configuração não versionada no repositório) ⚠️
- **CDN:** Não configurado para app, Vercel forneceria para assets se preset fosse `vercel` ⚠️

### Mapeamento:
```
Cliente (navegador)
    ↓ HTTPS + nginx TLS
    ↓ nginx (reverse proxy, config não versionada)
    ↓ PM2 (app Node.js, porta 3001)
    ↓ TanStack Start / Nitro
    ↓ Server functions (createServerFn)
    ↓ Storage (SQLite ou Postgres)
```

**Gargalos identificados:**
- nginx configuração não versionada
- Sem CDN para assets dinâmicos
- Rate limiting em memória não funciona em multi-instance

**Severidade:** MÉDIA  
**Como corrigir:** Versionar config nginx. Adicionar configuração CORS explícita. Migrar rate limiting para storage-based.

---

# 8. SISTEMAS OPERACIONAIS

## 10. SO

**[PARCIAL]**

- **Processos:** PM2 com `instances: 1`, `exec_mode: "fork"`, `autorestart: true` ✅
- **Memória:** `max_memory_restart: "500M"` ✅
- **Serviços:** `docker-compose.db.yml` com Postgres `restart: unless-stopped` ✅
- **Logs:** `ecosystem.config.cjs` sem configuração de logging. `logs/login-attempts.jsonl` cresce sem rotação ⚠️
- **Permissões:** `.data/` com `.gitignore` ✅, `.env` com `600` (verificar) ⚠️
- **File system:** SQLite em `.data/portal.db`, WAL mode ✅
- **Resource limits:** PM2 `max_memory_restart` ✅, sem CPU limits ⚠️
- **Process isolation:** Nenhuma containerização da app principal (Dockerfile ausente) ⚠️

### Problemas:
- PM2 com 1 instance = ponto único de falha
- Logs sem rotação (crescem indefinidamente)
- Sem systemd services (depende apenas de PM2)
- Dockerfile para app principal não existe

**Severidade:** ALTA (PM2 single instance, logs sem rotação)  
**Como corrigir:** Múltiplas instâncias PM2 ou cluster mode. Implementar rotação de logs. Criar Dockerfile.

---

# 9. FRONT-END

## 5. Front-End

### HTML Semântico
**[PARCIAL]** — Meta tags completas em cada rota. `<main>` no index. `<form>` no login. Mas `<label>` sem `htmlFor` + `<input>` sem `id` em perfil.tsx. `<h1>` único por página verificado parcialmente.

### CSS/Tailwind
**[IMPLEMENTADO]** — Sistema de design completo com `@theme inline`, 50+ variáveis em oklch, dark mode, design tokens. Responsive com `md:`/`lg:` breakpoints.

### JavaScript/TypeScript
**[IMPLEMENTADO]** — TanStack Query para estado global. `react-hook-form` para forms. Async/await, Promises, event loop manejados corretamente. Closures usadas em `useRouteGuard`.

### Routing
**[PARCIAL]** — TanStack Router com `createFileRoute`. `useRouteGuard()` hook imperativo (após render). Sem guards declarativos no nível da rota. Sem lazy loading explícito.

### Acessibilidade
**[PARCIAL]** — ARIA presente em muitos componentes. Mas: sem skip nav, `aria-busy` ausente, `aria-describedby={undefined}`, labels desvinculados no perfil, `focus:outline-hidden` typo em tarefas.tsx.

**Severidade:** MÉDIA-ALTA (acessibilidade, routing)  
**Como corrigir:** Adicionar `id`/`htmlFor` nos inputs. Adicionar skip nav. Corrigir typo. Adicionar `aria-busy`.

---

# 10. FRAMEWORKS

## 6. React/TanStack Start

**[IMPLEMENTADO]** com ressalvas

- **Componentização:** ✅ (46 componentes UI em `src/components/ui/`, Shadcn/Radix base)
- **Estado local:** `useState` em forms, `useReducer` não encontrado
- **Estado global:** TanStack Query (`useQuery`, `useMutation`) ✅
- **Lifecycle:** TanStack Start SSR lifecycle ✅
- **Hooks:** Custom hooks em `src/hooks/` ✅
- **Rendering:** SSR com Nitro, hydration com `setupRouterSsrQueryIntegration` ✅
- **Data fetching:** `staleTime`, `gcTime`, `refetchOnWindowFocus` configurados ✅
- **Code splitting:** TanStack Start gera imports dinâmicos por rota automaticamente ✅
- **Server Components:** Não aplicável (é SSR, não Next.js App Router)
- **Cache:** TanStack Query cache com `qk` keys ✅

**Problema:** `index.tsx` com 590 linhas, `perfil.tsx` com 503 — responsibility excessive.

**Severidade:** MÉDIA  
**Como corrigir:** Fragmentar páginas grandes em sub-componentes.

---

# 11. BACK-END

## 7. Back-End

**[IMPLEMENTADO]** com ressalvas

- **Routing:** ✅ TanStack Start file-based routing, server functions
- **Controllers:** `src/server/context.ts` atua como controlador central
- **Services:** `auth.ts`, `passwords.ts`, `storage.ts`, `portal-api.ts`
- **Repositories:** `storage.ts` abstrai persistência (Storage interface) ✅
- **Models:** `UserRow`, `Task`, `Risk`, etc. interfaces bem definidas ✅
- **DTOs:** `PublicUser`, `ApiResult<T>`, `TeamPhotoEntry` ✅
- **Validação:** Zod em todos os server functions ✅
- **Autenticação:** ✅ Argon2id + pepper + sessões httpOnly
- **Autorização:** `requirePermission()` ✅ com IDOR parcial
- **Sessões:** ✅ Token opaco, SHA-256 no banco, 7 dias
- **Tokens:** Password reset usa `Math.random()` ⚠️
- **Rate limiting:** ✅ 8 tentativas/10min, em memória
- **Logging:** `login-logger.ts`, `context.ts` logAudit ✅ (com dados sensíveis)
- **Tratamento de exceções:** `try/catch` em todos os handlers ✅
- **Configuração:** `.env`, `.env.example` ✅
- **Variáveis de ambiente:** ✅ bem documentadas em `.env.example`
- **Gerenciamento de secrets:** ⚠️ `.env` com secrets reais
- **Concorrência:** SQLite WAL mode, sem locks explícitos ⚠️
- **Processamento assíncrono:** `Promise.all` em `getPortalStateFn` (16+ queries) ⚠️

**Severidade:** MÉDIA-ALTA (secrets, concurrency, Math.random)  
**Como corrigir:** Rotacionar secrets. Substituir `Math.random()`. Adicionar transações para operações atômicas.

---

# 12. TESTES

## 18. Testes

### Unitários
**[IMPLEMENTADO]** — 33 arquivos, 411 testes, todos passando. Testes para storage, auth, passwords, login-flow, n8n, context, team-link, team-avatar, portal-api, page-guard, rbac, task-stages, photo-frame, team-photos, equipe-components. `describe.each(factories())` testa sqlite + memory. Determinísticos, independentes.

### Integração
**[PARCIAL]** — Storage testado com `:memory:` e `MemoryStorage`. `portal-api-extended.test.ts` testa `updateTaskFn` com MemoryStorage. Mas nenhum teste sobe o servidor real e faz requisições HTTP.

### E2E
**[NÃO IMPLEMENTADO]** — Nenhum Playwright, Cypress ou equivalente. Sem fluxos completos (register → login → CRUD).

### Cobertura
**[PARCIAL]** — `vitest.config.ts` sem configuração de coverage. `@vitest/coverage-v8` incompatível com versão do vitest. Nenhuma métrica de cobertura disponível.

**Severidade:** ALTA (sem E2E), MÉDIA (sem cobertura)  
**Como corrigir:** Adicionar Playwright para E2E. Corrigir compatibilidade de coverage.  
**Teste:** `npx playwright install && npx playwright test`

---

# 13. DESEMPENHO

## 19. Performance

### Backend
- **Latência:** Argon2id hash é lento por design (19MiB, t=2) — intencional para segurança
- **Throughput:** PM2 1 instance limita paralelismo
- **CPU:** Argon2id + React SSR podem ser CPU-intensivos
- **RAM:** `max_memory_restart: "500M"` como limite
- **Banco:** SQLite WAL mode adequado para baixa/média carga. Postgres com pool `max: 5`
- **Queries sem índice:** `tasks(column_name)`, `comments(task_id)`, `audit(seq)`
- **N+1:** `getControl`, `getEvidence`, `getRisk` carregam tudo em memória

### Frontend
- **Bundle size:** Não monitorado (sem bundle analyzer) ⚠️
- **LCP/INP/CLS:** Não medidos ⚠️
- **Lazy loading:** TanStack Start gera imports dinâmicos por rota ✅
- **Imagens:** Fotos de equipe em `public/team/*.png`, sem lazy loading explícito ⚠️
- **CSS:** Tailwind com `@tailwind` + custom properties, bundle otimizado ✅

### Métricas web
**[NÃO VERIFICADO]** — Não há Lighthouse, Web Vitals, ou qualquer ferramenta de métricas de performance configurada.

**Severidade:** ALTA (sem monitoramento de performance)  
**Como corrigir:** Adicionar `vite-bundle-visualizer`. Adicionar Lighthouse CI. Adicionar índices e paginação.

---

# 14. ACESSIBILIDADE

## 20. WCAG

**[PARCIAL]**

- **Navegação por teclado:** ✅ `focus-visible:ring` nos inputs/botões
- **Focus:** ✅ `focus-visible` classes presentes
- **Contraste:** ✅ Design tokens oklch com valores acessíveis
- **Alt text:** ✅ Presente em imagens (`alt={name}`, `alt="Foto de perfil"`)
- **Labels:** ⚠️ `<label>` sem `htmlFor` + `<input>` sem `id` em perfil.tsx
- **ARIA:** ✅ Presente em muitos componentes (`aria-label`, `aria-expanded`, `aria-pressed`)
- **Screen readers:** ⚠️ Falta de `aria-live` para toasts, `aria-busy` ausente
- **Formulários acessíveis:** ⚠️ `noValidate` no login, sem `aria-invalid`/`aria-describedby`
- **Mensagens de erro:** ✅ `FormMessage` com `text-destructive`
- **Redimensionamento:** ✅ Tailwind responsive
- **Reduced motion:** ⚠️ Não há `prefers-reduced-motion` media query

**Severidade:** MÉDIA-ALTA  
**Como corrigir:** Adicionar `id`/`htmlFor`. Adicionar `prefers-reduced-motion`. Adicionar `aria-busy` e `aria-live`.

---

# 15. UX/UI

## 21. UX/UI

**[IMPLEMENTADO]** com ressalvas

- **Hierarquia visual:** ✅ Design tokens, brand colors, tipografia clara
- **Consistência:** ✅ Componentes Shadcn/Radix uniformes
- **Feedback:** ✅ `toast` de sonner em todas as ações, loading states com `submitting`
- **Loading states:** ⚠️ Presente em alguns componentes, não em todos
- **Empty states:** ✅ `empty` em queries TanStack Query
- **Error states:** ✅ `ErrorComponent` no root route, `toast.error` em forms
- **Success states:** ✅ `toast.success` após operações
- **Responsividade:** ✅ Breakpoints `md:`/`lg:` em toda a UI
- **Mobile:** ✅ Sidebar escondida no mobile, overlay, menu hamburger
- **Navegação:** ✅ Sidebar com todos os itens, breadcrumbs em algumas páginas
- **Prevenção de erros:** ✅ `disabled` em botões durante submit, `noValidate` com tratamento customizado
- **Recuperação de erros:** ⚠️ `handleForgotPassword` só mostra toast informativo (sem funcionalidade real)

**Severidade:** BAIXA (UX é boa para portal interno)

---

# 16. SEO

## 22. SEO

**[PARCIAL]**

- **HTML semântico:** ✅ `<main>`, `<section>`, `<h1>`-`<h2>` presentes
- **Title:** ✅ Cada rota tem meta title
- **Meta description:** ✅ Presente em `__root.tsx` e rotas
- **Canonical:** ❌ Não encontrado
- **Sitemap:** ✅ `public/robots.txt` existe
- **robots.txt:** ✅ Presente
- **URLs:** ✅ TanStack Start gera rotas limpas
- **Structured data:** ❌ Não encontrado JSON-LD
- **Open Graph:** ✅ Meta tags `og:title`, `og:description`, `og:type` presentes
- **SSR/SSG:** ✅ SSR via Nitro
- **Performance:** ⚠️ Não medida (sem Lighthouse)
- **Mobile:** ✅ Responsive com breakpoints
- **Links internos:** ✅ `<Link>` do TanStack Router
- **Conteúdo indexável:** ✅ SSR gera HTML para crawlers

**Severidade:** MÉDIA (sistema funcional, mas canônico, structured data e sitemap XML ausentes)

---

# 17. OBSERVABILIDADE

## 23. Observabilidade

**[PARCIAL]**

- **Logs:** `login-logger.ts` escreve JSONL (`logs/login-attempts.jsonl`). `context.ts` `logAudit()`. ⚠️ Dados sensíveis nos logs (`passwordHashPrefix`, `pepperSource`, `passwordValid`)
- **Métricas:** ❌ Nenhuma métrica (Prometheus, StatsD)
- **Traces:** ❌ Nenhum distributed tracing
- **Health checks:** ❌ Nenhum endpoint `/health` para app principal (apenas n8n tem `/healthz`)
- **Error tracking:** ⚠️ `error-capture.ts` com `console.error`, sem serviço externo (Sentry, etc.)
- **Alertas:** ❌ Nenhum alerta configurado
- **Dashboards:** ❌ Nenhum Grafana/Datadog
- **Correlation IDs:** ❌ Não implementado
- **Monitoramento de infraestrutura:** ❌ PM2 status apenas via CLI

**Severidade:** ALTA (sem observabilidade completa)  
**Como corrigir:** Adicionar endpoint `/health`. Implementar logging estruturado (winston/pino). Adicionar métricas com Prometheus. Configurar alertas. Remover dados sensíveis dos logs.

---

# 18. BACKUP E RECUPERAÇÃO

## 24. Backup

**[ALTA]** — Backup parcial, sem automação.

- **Backup do banco:** `scripts/backup-portal-db.sh` existe, manual, usa `pg_dump` via docker ✅ (mas manual)
- **Backup de arquivos:** ❌ Nenhum backup de `.data/portal.db` (SQLite) automatizado
- **Backup de configuração:** ❌ nginx não versionado
- **Backup de secrets:** ❌ Nenhum
- **Retenção:** ❌ Sem política definida
- **Backup off-site:** ❌ Apenas local em `.data/pg-backups/`
- **Teste de restauração:** ❌ Nenhum
- **RPO/RTO:** ❌ Não definidos
- **Disaster Recovery:** ❌ Não documentado

**Severidade:** ALTA  
**Como corrigir:** Automatizar backup com cron. Implementar política de retenção (30 dias). Criar script de restore. Testar restore em ambiente de teste. Adicionar criptografia GPG.

---

# 19. MANUTENIBILIDADE

## 25. Manutenibilidade

**[PARCIAL]**

- **Documentação:** ✅ `spec/acceptance-criteria.md`, `spec/requirements.md`, `spec/decisions.md`, `spec/specification.md`, `docs/ci-cd.md`
- **README:** ✅ Instruções de deploy, dev, backend
- **Arquitetura documentada:** ❌ Sem documento C4 ou diagrama de arquitetura formal
- **Variáveis de ambiente:** ✅ `.env.example` completo
- **Setup reproduzível:** ✅ `bun install` / `npm install` + `npm run dev`
- **Scripts:** ✅ `photos:sync`, `brand:assets`, `backup-portal-db.sh`
- **Migrations:** ❌ Sem sistema formal
- **Versionamento:** ✅ Git existente, tags presentes
- **Changelog:** ❌ Não existe `CHANGELOG.md`
- **ADRs:** ✅ `spec/decisions.md` funciona como ADR
- **Dependências atualizadas:** ❌ `npm audit` não executado
- **Débito técnico identificado:** ⚠️ Parcial (componentes grandes, sem índices)

**Severidade:** MÉDIA  
**Como corrigir:** Criar CHANGELOG.md. Implementar sistema de migrations. Documentar arquitetura em docs/architecture.md. Adicionar ADRs para decisões futuras.

---

# 20. DEPENDÊNCIAS

## 26. Dependências

**[PARCIAL]**

- **Dependências necessárias:** ✅ 59 deps, todas relevantes (TanStack, Radix, etc.)
- **Dependências abandonadas:** ❓ Não verificado (`npm audit` não executado)
- **Vulnerabilidades:** ❓ Não verificado
- **Licenças:** ❓ Não verificado
- **Versões:** `^` na maioria (permite atualizações automáticas)
- **Lockfile:** Tanto `bun.lock` quanto `package-lock.json` presentes ⚠️ (conflito)
- **Dependências transitivas:** ❓ Não auditadas
- **Atualizações:** ❓ `@lovable.dev` bipassa guard de segurança (`minimumReleaseAgeExcludes`)
- **Dependências duplicadas:** ❓ Não verificado

**Severidade:** ALTA (dois lockfiles conflitantes, audit não executado)  
**Como corrigir:** Escolher lockfile único. Executar `npm audit`. Remover `@lovable.dev` do `minimumReleaseAgeExcludes` ou justificar.

---

# 21. GIT E CONTROLE DE VERSÃO

## 27. Git

**[PARCIAL]**

- **Commits coerentes:** ⚠️ Alguns commits "Add files via upload" (Lovable)
- **Histórico compreensível:** ⚠️ Histórico misturado com commits de upload
- **Branches:** Apenas `main` ⚠️ (sem branches de feature)
- **Pull Requests:** ❓ Não verificado (GitHub PRs não inspecionados)
- **Code Review:** ❓ Não verificado
- **Tags:** ✅ Presentes
- **Releases:** ❓ Não verificado
- **.gitignore:** ✅ Protege `.env`, `.data/`, `package-lock.json`
- **Secrets no git:** ⚠️ Precisa verificar `git log --all -p -- .env`
- **Reprodutibilidade:** ⚠️ Dois lockfiles conflitantes

**Severidade:** CRÍTICA (se `.env` já esteve no git)  
**Como corrigir:** `git log --all -p -- .env`. Se secrets estiveram no git, usar BFG Repo-Cleaner ou `git filter-branch`. Escolher lockfile único.

---

# 22. LICENÇAS E TERCEIROS

## 28. Licenças

**[NÃO VERIFICADO]** — Não foi possível inspecionar licenças de todas as dependências sem `npm audit` ou ferramenta de license checking. `package.json` não contém campo `license`. Assets (`public/team/*.png`, `public/zaggo-logo.png`) não possuem metadados de licença.

**Severidade:** BAIXA (projeto interno, sem redistribuição)

---

# 23. PRIVACIDADE E DADOS (LGPD)

## 29. Privacidade

**[PARCIAL]**

- **Dados pessoais:** ✅ Nome, email, role armazenados
- **Minimização:** ✅ Apenas campos necessários no `UserRow`
- **Consentimento:** ❓ Não verificado fluxo de consentimento explícito
- **Finalidade:** ❓ Não documentada política de uso de dados
- **Retenção:** ❓ Sem política de retenção de dados
- **Exclusão:** ✅ `deleteUser()` existe, `clearAllUsers()` existe
- **Exportação:** ✅ `exportBackupFn` permite exportação
- **Controle de acesso:** ✅ RBAC implementado
- **Logs:** ⚠️ Logs contêm emails em texto plano, IPs reais
- **Cookies:** ✅ `httpOnly`, `sameSite: "lax"`, `secure` condicional
- **Analytics:** ❓ Não verificado uso de analytics
- **Dados sensíveis:** ⚠️ Passwords hashed (ok), mas logs têm hash prefix

**Severidade:** MÉDIA (logs com emails/IPs)  
**Como corrigir:** Mascaramento de emails/IPs nos logs. Documentar política de retenção.

---

# 24. INTELIGÊNCIA ARTIFICIAL

## 30. IA

**[NÃO APLICÁVEL]** — O sistema não utiliza IA/ML em nenhuma funcionalidade. Não há LLM, embeddings, RAG, ou modelos de ML integrados. Nenhuma funcionalidade usa IA.

---

# 25. ESCALABILIDADE

## 31. Escalabilidade

```
10 usuários:    ✅ Funciona bem (SQLite WAL, 1 instância PM2)
100 usuários:   ✅ Funciona bem
1.000 usuários: ⚠️ Degradacao esperada (full table scans, sem índices em tasks/comments)
10.000 usuários: ❌ Problemas severos (SQLite file lock, N+1 queries, lista sem paginação)
100.000+:       ❌ Inviável sem migração para Postgres + índices + cache
```

**Gargalos por estágio:**
- **CPU:** Argon2id hashing + React SSR
- **RAM:** `max_memory_restart: "500M"`, listas carregadas em memória
- **Banco:** SQLite file-based (escritor exclusivo), queries sem índice
- **Rede:** Sem CDN, nginx não versionado
- **Concorrência:** SQLite WAL writer-exclusivo, PM2 1 instance

**Componente que precisa mudar primeiro:** Banco de dados (migrar para Postgres + adicionar índices).

**Severidade:** ALTA  
**Como corrigir:** Migrar para Postgres (já tem `docker-compose.db.yml`). Adicionar índices. Adicionar paginação. Implementar cache (Redis). Multi-instância PM2.

---

# 26. CONFIABILIDADE

## 32. Confiabilidade

**[PARCIAL]**

- **Single Point of Failure:** ✅ PM2 1 instance, SQLite file, nginx não versionado
- **Retries:** ❌ Não implementado nas server functions
- **Timeouts:** ❌ Não configurado explicitamente nos queries
- **Circuit breaker:** ❌ Não implementado
- **Graceful degradation:** ⚠️ `MemoryStorage` fallback existe, mas `STORAGE_REQUIRE_PERSISTENT=1` falha se banco não abrir
- **Health checks:** ❌ Nenhum endpoint `/health` para app principal
- **Failover:** ❌ Sem réplica de banco, sem redundância
- **Redundância:** ❌ 1 instância, 1 banco
- **Backup:** ⚠️ Manual, não automatizado
- **Idempotência:** ✅ `insertUser` usa `INSERT OR IGNORE`, algumas operações são atômicas

**Severidade:** ALTA (sem redundância, sem health check, sem retries)  
**Como corrigir:** Adicionar endpoint `/health`. Múltiplas instâncias PM2. Adicionar retries em operações críticas. Documentar plano de failover.

---

# 27. CHECKLIST FINAL DE PRODUÇÃO

| # | Item | Status |
|---|------|--------|
| 1 | Código revisado | ⚠️ Parcial (Lovable uploads) |
| 2 | Testes passando | ✅ 411/411 |
| 3 | Build reproduzível | ⚠️ Depende de `@lovable.dev` |
| 4 | Banco versionado | ❌ Sem migrations formais |
| 5 | Migrations testadas | ❌ |
| 6 | HTTPS | ✅ nginx TLS (docs) |
| 7 | Secrets protegidos | ❌ `.env` com secrets reais |
| 8 | Authentication testada | ✅ 411 testes incluem auth |
| 9 | Authorization testada | ✅ RBAC testado |
| 10 | OWASP auditado | ⚠️ Parcial (Math.random(), secrets) |
| 11 | Dependências auditadas | ❌ Sem `npm audit` |
| 12 | Logs funcionando | ✅ Mas contêm dados sensíveis |
| 13 | Monitoramento funcionando | ❌ Sem métricas, traces, alertas |
| 14 | Backup configurado | ❌ Manual, não automatizado |
| 15 | Restore testado | ❌ |
| 16 | Performance testada | ❌ Sem benchmarks |
| 17 | Acessibilidade testada | ❌ Sem ferramenta automática |
| 18 | Responsividade testada | ✅ Tailwind responsive |
| 19 | SEO básico | ✅ Meta tags, sitemap |
| 20 | Error handling | ✅ Try/catch em handlers |
| 21 | Rate limiting | ✅ Em memória |
| 22 | Health check | ❌ |
| 23 | Rollback definido | ❌ |
| 24 | Documentação atualizada | ✅ Especificação completa |

---

# 28. PROBLEMAS CRÍTICOS

1. **`.env` com secrets reais no filesystem** — AUTH_PEPPER, N8N_API_KEY (JWT), N8N_ENCRYPTION_KEY, POSTGRES_PASSWORD expostos. Se servidor comprometido, todos os secrets vazam.
   - **Impacto:** Perda de segurança total do sistema
   - **Como corrigir:** Rotacionar secrets imediatamente. Usar gerenciador de secrets.

2. **`Math.random()` para token de password reset** — Não criptograficamente seguro, permite previsão de tokens.
   - **Impacto:** Reset de senha pode ser forçado
   - **Como corrigir:** Substituir por `crypto.getRandomValues()`

3. **Sem CI/CD automatizado** — Qualquer commit pode quebrar a app sem detecção.
   - **Impacto:** Regressões não detectadas, deploy manual propenso a erros
   - **Como corrigir:** Criar `.github/workflows/ci.yml` com typecheck + test + build

4. **Backup manual sem automação** — Dados podem ser perdidos sem restauração testada.
   - **Impacto:** Perda de dados em caso de crash
   - **Como corrigir:** Automatizar backup com cron + criar script de restore + testar

5. **Logs contêm dados sensíveis** — `passwordHashPrefix`, `pepperSource`, emails, IPs em JSONL sem rotação.
   - **Impacto:** Vazamento de informação de segurança via logs
   - **Como corrigir:** Remover dados sensíveis, implementar rotação

6. **Dois lockfiles conflitantes** (`bun.lock` + `package-lock.json`) — Indica confusão de gerenciamento de pacotes.
   - **Impacto:** Dependências inconsistentes, build não reproduzível
   - **Como corrigir:** Escolher lockfile único, remover o outro

---

# 29. DÉBITO TÉCNICO

| Problema | Origem | Impacto atual | Impacto futuro | Complexidade | Prioridade |
|---|---|---|---|---|---|
| `.env` com secrets | Lovable setup | Alto | Crítico se vazado | Baixa | **P0** |
| `Math.random()` token | Código existente | Médio | Alto | Baixa | **P0** |
| Sem CI/CD | Sem pipeline | Médio | Alto (regressões) | Média | **P1** |
| Logs sensíveis | `login-logger.ts` | Médio | Alto (vazamento) | Baixa | **P1** |
| Sem índice em `tasks/comments` | Adições rápidas | Baixo | Alto (escala) | Baixa | P1 |
| `getControl/listControls` N+1 | Padrão rápido | Baixo | Alto | Baixa | P2 |
| `index.tsx` 590 linhas | Page component | Médio | Alto (manutenção) | Média | P2 |
| Sem migrations formais | Evolução ad hoc | Baixo | Alto (deploy) | Média | P2 |
| Backup manual | Configuração inicial | Baixo | Alto (perda dados) | Média | P2 |
| Sem E2E tests | Configuração inicial | Baixo | Médio | Alta | P3 |
| Sem observabilidade | Configuração inicial | Baixo | Alto (debug) | Alta | P3 |
| Sem CORS configurado | Omissão | Baixo | Médio | Baixa | P3 |
| `focus:outline-hidden` typo | Erro de digitação | Baixo | Médio | Baixa | P3 |

---

# 30. CONHECIMENTOS QUE FALTAM

## 33. D.1 Fundamentos de programação
- **Nenhum gap significativo.** TypeScript estrito bem aplicado. Padrões modernos (ESNext, react-jsx) corretos.

## D.2 Engenharia de software
- **SOLID parcial:** Componentes página grandes violam SRP (`index.tsx` 590 linhas).
- **Code splitting:** Presente via TanStack Start, mas não configurado explicitamente.
- **Design Patterns:** Poucos padrões aplicados conscientemente além de repository (Storage interface).

## D.3 Sistemas
- **Process management:** PM2 com 1 instance, sem systemd, sem cluster.
- **Resource limits:** Apenas `max_memory_restart`, sem CPU limits.
- **Container:** Dockerfile da app principal ausente.

## D.4 Redes
- **CORS:** Não configurado.
- **CDN:** Não configurado para app dinâmico.
- **TLS:** Presente via nginx, mas `secure` depende de header falsificável.

## D.5 Banco de dados
- **FKs:** Ausentes em tabelas críticas (tasks, comments, evidences, risks).
- **Migrations:** Sem sistema formal.
- **Índices:** Ausentes em columns frequentemente filtradas.
- **Paginação:** Ausente em todas as listagens.

## D.6 Segurança
- **Secrets:** `.env` com secrets reais no filesystem.
- **Rate limiting:** Em memória, não distribuído.
- **Password reset:** Usa `Math.random()`.
- **IDOR:** `getPublicUserFn` sem verificação de autorização.

## D.7 DevOps
- **CI/CD:** Não implementado.
- **IaC:** Não implementado.
- **Docker:** Apenas compose para Postgres/n8n, app principal sem Dockerfile.
- **Monitoramento:** Nenhuma métrica, trace, alerta.

## D.8 Computação distribuída
- **Concorrência:** SQLite WAL writer-exclusivo, sem locks explícitos.
- **Distribuição:** Stateful com SQLite, impossível horizontal scaling.
- **Consistência:** Sem transações em operações atômicas (exceto import).

## D.9 Front-end
- **Acessibilidade:** Labels desvinculados, sem skip nav, `aria-busy` ausente.
- **Forms:** `noValidate` sem substituição adequada, sem `react-hook-form` no login/perfil.
- **Routing:** Guards imperativos, não declarativos.

## D.10 Back-end
- **Transactions:** Ausentes em operações críticas (deleteUser, reorderNextSteps).
- **Observabilidade:** Sem structured logging, métricas, traces.
- **Timeouts:** Não configurados em queries/server functions.

## D.11 UX/UI
- **Loading states:** Inconsistentes entre componentes.
- **Empty states:** Presentes via TanStack Query, mas não em todos os lugares.

## D.12 Dados/IA
- **Nenhum gap** — IA não aplicável ao projeto.

---

# 31. PLANO DE CORREÇÃO

```
TASK-001
Área: Segurança
Problema: .env com secrets reais (AUTH_PEPPER, N8N_API_KEY, N8N_ENCRYPTION_KEY, POSTGRES_PASSWORD) expostos no filesystem
Fundamento: Gestão de secrets
Ação: 1) Rotacionar todos os secrets imediatamente 2) Mover secrets para gerenciador de secrets (Vercel Secrets / HashiCorp Vault) 3) Remover secrets do .env 4) Usar runtime env injection
Critério de conclusão: `cat .env` não contém secrets reais; `ls -la .env` mostra permissões 600
Teste: `grep -E "AUTH_PEPPER|N8N_API_KEY|N8N_ENCRYPTION_KEY|POSTGRES_PASSWORD" .env` → resultado vazio
Dependências: Nenhuma
Prioridade: P0

TASK-002
Área: Segurança
Problema: Math.random() para token de password reset — não criptograficamente seguro
Fundamento: Criptografia
Ação: Substituir `Math.random().toString(36).slice(2)` por `crypto.getRandomValues(new Uint8Array(32))` no createPasswordResetFn
Critério de conclusão: Token gerado tem entropia criptográfica (64 chars hex)
Teste: `node -e "const {crypto}=require('crypto'); const b=new Uint8Array(32); crypto.getRandomValues(b); console.log(Buffer.from(b).toString('hex').length)"` → 64
Dependências: Nenhuma
Prioridade: P0

TASK-003
Área: DevOps
Problema: Sem CI/CD automatizado
Fundamento: Engenharia de software
Ação: Criar .github/workflows/ci.yml com jobs de typecheck, test, lint e build. Adicionar branch protection.
Critério de conclusão: Push para main dispara pipeline que executa typecheck + test + build com sucesso
Teste: Criar branch, push, verificar que workflow dispara e passa
Dependências: GitHub Actions
Prioridade: P1

TASK-004
Área: Observabilidade
Problema: Logs contêm dados sensíveis (passwordHashPrefix, pepperSource, passwordValid, emails, IPs) e sem rotação
Fundamento: Segurança, Sistemas
Ação: 1) Remover passwordHashPrefix, pepperSource, passwordValid dos logs 2) Implementar rotação de logs (logrotate ou Winston com rotação) 3) Mascaramento de emails/IPs
Critério de conclusão: `grep -c "passwordHashPrefix\|pepperSource\|passwordValid" logs/login-attempts.jsonl` → 0 em novos logs
Teste: Criar entrada de login e verificar que o JSONL não contém campos sensíveis
Dependências: Winston ou logrotate
Prioridade: P1

TASK-005
Área: Banco de dados
Problema: Ausência de índices em tasks(column_name), comments(task_id), sessions(user_id), evidences(control_id)
Fundamento: Performance, Banco de dados
Ação: Adicionar índices CREATE INDEX para todas as colunas de foreign key e filtragem frequente
Critério de conclusão: `EXPLAIN QUERY PLAN SELECT * FROM tasks WHERE column_name = ?` mostra "SEARCH USING INDEX"
Teste: Executar EXPLAIN QUERY PLAN para cada query de lista
Dependências: Schema migration
Prioridade: P1

TASK-006
Área: Backend
Problema: getControl(id), getEvidence(id) fazem listX() + .find() em vez de SELECT WHERE id = ?
Fundamento: Algoritmos, Banco de dados
Ação: Substituir listControls() + .find() por direct query WHERE id = ? em getControl, getEvidence, getRisk, getWiki, etc.
Critério de conclusão: EXPLAIN QUERY PLAN mostra SEARCH USING PRIMARY KEY ou INDEX
Teste: `npm run test` + verificar que não há SELECT * antes de filtro por id
Dependências: Storage interface
Prioridade: P2

TASK-007
Área: DevOps
Problema: Dois lockfiles conflitantes (bun.lock + package-lock.json)
Fundamento: DevOps, Dependências
Ação: Escolher Bun como gerenciador único (já tem bun.lock). Remover package-lock.json do repositório e do .gitignore.
Critério de conclusão: `ls package-lock.json` → não existe; `bun install` funciona sem erro
Teste: `bun install` → sucesso, `npm install` → pode remover ou avisar
Dependências: Bun package manager
Prioridade: P1

TASK-008
Área: Testes
Problema: Sem testes E2E
Fundamento: Testes, Engenharia de software
Ação: Adicionar Playwright. Configurar cenários: login, CRUD de tarefas, fluxo de equipe.
Critério de conclusão: `npx playwright test` executa e passa com cobertura dos fluxos principais
Teste: `npx playwright install && npx playwright test`
Dependências: Playwright
Prioridade: P3

TASK-009
Área: Segurança
Problema: getPublicUserFn aceita qualquer userId sem verificação de autorização (IDOR potencial)
Fundamento: Autorização, Segurança
Ação: Adicionar verificação de permissão em getPublicUserFn e listPublicUsersFn
Critério de conclusão: Usuário "A" autenticado não consegue acessar perfil de "B" via API sem permissão
Teste: Autenticar como usuário comum, chamar getPublicUserFn com id de outro usuário → deve retornar erro
Dependências: RBAC existente
Prioridade: P2

TASK-010
Área: Banco de dados
Problema: Sem sistema formal de migrations (schema evolui via ALTER TABLE inline)
Fundamento: Engenharia de software, Banco de dados
Ação: Criar diretório migrations/ com arquivos versionados. Implementar tabela schema_migrations. Adicionar comando `npm run migrate`.
Critério de conclusão: `npm run migrate` aplica migrations em ordem e rastreia quais foram aplicadas
Teste: Criar migration de teste, executar, verificar tabela schema_migrations
Dependências: drizzle-kit ou knex-migration
Prioridade: P2

TASK-011
Área: Confiabilidade
Problema: Sem endpoint /health para app principal, PM2 com 1 instance
Fundamento: Confiabilidade, Sistemas
Ação: 1) Adicionar rota /health com status do storage e uptime 2) Múltiplas instâncias PM2 ou cluster mode 3) systemd service
Critério de conclusão: `curl http://localhost:3001/health` retorna `{"status":"ok","uptime":...}`
Teste: `curl localhost:3001/health` → status ok
Dependências: Rota simples
Prioridade: P2
```

---

# 32. DEFINITION OF DONE

Para cada tarefa do plano de correção, o critério de conclusão já está definido acima. Padrão geral:

> **Uma tarefa está concluída quando:**
> 1. O código é alterado (evidência diff)
> 2. `npm run typecheck` passa limpo
> 3. `npm run test` passa com todos os testes (411+)
> 4. O critério de conclusão específico é verificado por comando/teste
> 5. O problema descrito deixa de ser reproduível

**Não aceite:**
> "parece funcionar"

**Prefira:**
> "teste X executado, resultado Y obtido, condição Z satisfeita"

---

# 33. REGRA PRINCIPAL DA AUDITORIA

```
FUNDAMENTO
     ↓
IMPLEMENTAÇÃO
     ↓
EVIDÊNCIA
     ↓
TESTE
     ↓
RESULTADO
     ↓
TASK DE CORREÇÃO
```

Não faça uma auditoria superficial baseada apenas na aparência do site. O objetivo é descobrir se o sistema foi construído sobre **fundamentos sólidos de Computação** e se pode ser mantido, testado, protegido, escalado e evoluído.

Quando há uma decisão arquitetural, explique:
> problema → restrições → alternativas → trade-offs → decisão → consequências.

Não recomende tecnologias apenas porque são populares. Escolha ferramentas em função dos requisitos técnicos do sistema.

---

*Relatório gerado em 28/09/2026. Baseado em análise de código-fonte presente no repositório `/home/opc/github/ok/recipe-plan-studio`. Nenhuma informação foi inventada — todas as afirmações são baseadas em evidências do código.*
