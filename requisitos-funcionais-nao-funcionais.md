# Requisitos Funcionais e Não Funcionais — Portal ZAGGO (GWG)

> Documento de varredura completa a partir do código, documentação (`spec/`, `docs/`, `README.md`) e código-fonte (`src/`).

---

## 1. Visão Geral do Projeto

**Nome:** Portal de Governança ZAGGO — Grupo W. Geotec (GWG)  
**Tipo:** Aplicação web (frontend React 19 + backend Nitro / TanStack Start)  
**Objetivo:** Portal executivo de acompanhamento de projeto para cliente, com tarefas visuais (Kanban 5 etapas), compliance, riscos, wiki, auditoria, automação (n8n), analytics de comportamento e RBAC real.

---

## 2. Requisitos Funcionais (RF)

### 2.1 Autenticação e Sessão (REQ-001 / REQ-002 / REQ-014)

| ID | Requisito | Detalhes e Restrições |
|---|---|---|
| RF-01 | Login com e-mail e senha | Cookie `geos_session` (token opaco 256 bits, SHA-256 no banco). Login timing-safe (hash dummy quando e-mail não existe). |
| RF-02 | Cadastro de usuário | Com `REGISTRATION_CODE` (`GEOS2026`) ou convite (`invite`). Auto-heal: primeiro usuário vira `admin`. |
| RF-03 | Logout | Destruição da sessão (`auth.destroyCurrentSession`). |
| RF-04 | Sessão persistente | Cookie `httpOnly`; banco guarda apenas SHA-256 do token. |
| RF-05 | Reset de senha / Convites | Token de reset (`ResetToken`); convite válido por tempo limitado (`InviteRow`). |

**Papéis (RBAC):** `admin`, `diretor`, `gestor`, `desenvolvedor`, `auditor`, `visualizador`, `cliente`.  
**Funções individuais:** `grantUserFunction` / `revokeUserFunction` (admin concede).  
**Auto-recuperação:** qualquer usuário autenticado pode se tornar `admin` se nenhum admin existir (`promoteSelfFn`).

---

### 2.2 Tarefas — Kanban Visual (REQ-004 / REQ-005 / REQ-011 / AC-011 / AC-013)

| ID | Requisito | Detalhes e Restrições |
|---|---|---|
| RF-06 | Criar tarefa | Título, descrição, prioridade (`Alta`/`Média`/`Baixa`), tags (até 8), responsável (`assignee`), prazo (`due`: `dd/mm/aaaa`), etapa (`stage`), progresso (`progress` 0-100). Se `stage = waiting_client`, `responsible` é obrigatório. |
| RF-07 | Listar tarefas | Filtros por coluna/etapa, prioridade, responsável. Visualização em Board, Lista e Tabela. Dados reais do banco (`getPortalStateFn`). |
| RF-08 | Mover tarefa | Entre colunas (`Backlog`, `Em andamento`, `Aguardando você`, `Em revisão`, `Concluído`). Cada movimento gera registro de auditoria (`before`/`after`). Mover para `Concluído` exige permissão `task.approve`. |
| RF-09 | Etapas canônicas (`stage`) | 5 etapas: `not_started`, `in_progress`, `waiting_client`, `review`, `done`. Derivadas de `column` na migração aditiva (`updateTaskStageProgress`). Progresso derivado: `not_started=0`, `in_progress=50`, `waiting_client=60`, `review=80`, `done=100`. |
| RF-10 | Comentários em tarefas | `insertComment` (`body` até 1000 chars). Vinculado ao `taskId`. Gera auditoria. |
| RF-11 | Progresso e responsável obrigatório | Se `waiting_client`, `responsible` não pode ser vazio. Progresso deve ser `0 ≤ progress ≤ 100`. |
| RF-12 | Tarefas read-only para `cliente` | Role `cliente` (futuro/deploy) vê apenas `/tarefas` read-only e pode comentar (`task.comment`). Bloqueado em admin/auditoria/compliance/etc. (`DEC-015`). |

**Componentes:** `ClickUpTaskCard`, `TaskBoard`, `TaskTable`, `TaskDialog`, `AppSidebar`.  
**Validações Zod:** `title` (1-120 chars), `tags` (max 8), `due` (`dd/mm/aaaa`), `progress` (`0-100`), `responsible` obrigatório quando `stage = waiting_client`.

---

### 2.3 Controles de Compliance e Evidências (REQ-006 / AC-006)

| ID | Requisito | Detalhes e Restrições |
|---|---|---|
| RF-13 | Cadastro de controles | `ComplianceControl` com `norm` (`LGPD` | `ISO 27001` | `SOX`), `owner`, `role`, `status`, `lastReview`, `nextReview`, `overdue` (calculado). |
| RF-14 | Revisão de controle | `reviewControl` define `status: "Conforme"`, `lastReview` (hoje), `nextReview` (+6 meses), `overdue: false`. Gera auditoria. |
| RF-15 | Anexar evidência | `attachEvidenceFn`: arquivo (`fileName` até 160 chars), `status: "Em revisão"`, `sentById`, `at`. Gera auditoria. |
| RF-16 | Avaliar evidência | `reviewEvidenceFn`: `approved` (`true`/`false`), `note` (até 300 chars), `reviewerName`, `reviewedAt`. Status: `Aprovada` / `Rejeitada`. Só revisa se status atual é `"Em revisão"`. |

**Status automático:** `Conforme`, `Próximo do vencimento`, `Vencido`, `Não conforme` (derivado de `lastReview` + `nextReview` vs. data atual).

---

### 2.4 Documentos Legais, Wiki e Artigos (REQ-007 / AC-007)

| ID | Requisito | Detalhes e Restrições |
|---|---|---|
| RF-17 | Artigos Wiki (`WikiArticle`) | `slug` único, `title`, `category`, `summary`, `updatedAt`, `version` (`v1`, etc.), `sections` (título + corpo). Se `slug` já existe → rejeita (`ok: false`). |
| RF-18 | Documentos Legais (`LegalDoc`) | `title`, `subtitle`, `updatedAt`, `version`, `intro`, `clauses`. Usados em `/termos` e `/lgpd`. |
| RF-19 | Documentos Genéricos (`DocRecord`) | `upsertDoc`: inserção ou atualização (`ON CONFLICT`). |

---

### 2.5 Riscos (REQ-008 / AC-008)

| ID | Requisito | Detalhes e Restrições |
|---|---|---|
| RF-20 | Cadastro de risco | `title` (5-120 chars), `category` (2-40 chars), `owner` (2-80 chars, obrigatório), `probability` (1-5), `impact` (1-5), `mitigation` (10-500 chars, obrigatório), `status` (`ativo`/`critico`/`em_tratamento`/`mitigado`/`pendente_cliente`), `nextAction` (até 500 chars), `due`, `taskId`. |
| RF-21 | Atualização de risco | Atualiza campos opcionais; valida `responsible` apenas se `data.role` alterado e usuário não é `admin`/`diretor`. Gera auditoria. |
| RF-22 | Exclusão de risco | `deleteRiskFn`: só se tiver permissão `risk.manage`. Gera auditoria. |
| RF-23 | Geração automática de riscos (`generateAutoRisksFn`) | Baseada em tarefas vencidas (`due < now`, `column != "Concluído"`) e controles vencidos. Cria riscos com `probability=3`, `impact=4`, `status=ativo` (ou derivado). Gera auditoria (`"Risco auto-gerado"`). |

**Restrição RBAC:** se `data.role` é diferente do `user.role` e usuário não é `admin`/`diretor`, rejeita (`"Seu papel só permite criar/atribuir riscos à sua própria role"`).

---

### 2.6 Módulos, Milestones, Releases, Patentes, Stack Técnico (REQ-009)

| ID | Requisito | Detalhes e Restrições |
|---|---|---|
| RF-24 | Módulos (`Module`) | `name` (2-60 chars), `status` (`string`), `tone` (`success`/`info`/`warning`/`neutral`/`danger`/`brand`), `date` (`YYYY-MM-DD`), `done`, `total`. Inserção (`addModuleFn`) e remoção (`removeModuleFn`) exigem `admin.manage`. |
| RF-25 | Milestones (`Milestone`) | `date` (`YYYY-MM-DD`), `type` (`Entrega`/`Integração`/`Marco`/`Decisão`), `title`, `description`. |
| RF-26 | Releases (`Release`) | `version` (texto), `date`, `items` (`string[]`). |
| RF-27 | Estágios de Patente (`PatentStage`) | `title`, `description`, `owner`, `deadline` (`YYYY-MM-DD`), `status` (`Concluído`/`Em Andamento`/`Pendente`/`Aguardando`). |
| RF-28 | Stack Técnico (`TechItem`) | `name`, `category`, `description`, `icon` (opcional). Usado na página de engenharia/compliance. |

---

### 2.7 Automação e Próximos Passos (REQ-010)

| ID | Requisito | Detalhes e Restrições |
|---|---|---|
| RF-29 | Compartilhamento de automações (`AutomationShare`) | `upsertAutomationShare`: inserção ou atualização (`id`, `name`, `url`, `description`). |
| RF-30 | Próximos passos (`NextStep`) | `title`, `description`, `status`, `due` (`YYYY-MM-DD`). Ordenação via `reorderNextSteps`. |

---

### 2.8 Integração n8n — Ponta a Ponta (REQ-016 / AC-020)

| ID | Requisito | Detalhes e Restrições |
|---|---|---|
| RF-31 | Listar workflows n8n (`GET /api/v1/workflows`) | `listN8nWorkflowsFn`: `GET` para `N8N_URL` (`http://127.0.0.1:5679`) com `X-N8N-API-KEY` quando configurado. Retorna `N8nWorkflow[]`. |
| RF-32 | Obter workflow (`GET /api/v1/workflows/{id}`) | `getN8nWorkflow(id)`. |
| RF-33 | Criar workflow (`POST /api/v1/workflows`) | `createN8nWorkflow(payload)`. `Content-Type: application/json`. |
| RF-34 | Atualizar workflow (`PUT /api/v1/workflows/{id}`) | `updateN8nWorkflow(id, payload)`. |
| RF-35 | Excluir workflow (`DELETE /api/v1/workflows/{id}`) | `deleteN8nWorkflow(id)`. |
| RF-36 | Provisão de usuário n8n (`/rest/register`, porta 3456) | `provisionN8nUser`: POST para `http://127.0.0.1:3456/rest/register` (nginx/custom). Corpo: `{email, firstName, lastName, password}` (senha temporária `"Temp12345!"` — **risco documentado**, deve ser removida). Cria usuário no SQLite n8n com `bcrypt`. |
| RF-37 | Login portal → n8n (SSO / unificação) | `email.auth-handler.js` consulta Postgres do portal (`password_hash` `PHC` argon2id + `AUTH_PEPPER`). Se válido, cria/encontra usuário n8n (`bcrypt`). **Sem cookie de sessão compartilhado ainda** (documentado como limitação, Fase 2/3 do plano). |
| RF-38 | Iframe `/automacoes` (`n8nPublicUrl`) | `iframe src={n8nUrl}` onde `n8nUrl` vem de `getN8nInfoFn()` (`publicUrl`). Se `N8N_PUBLIC_URL` configurado (`https://...`), usa HTTPS. **Problema confirmado:** `X-Frame-Options: SAMEORIGIN` bloqueia iframe cross-origin. **Solução proposta:** proxy same-origin (`/n8n/*`). |
| RF-39 | Validação de URL n8n (SSRF) | `validateN8nUrl` / `isBlockedIp` / `safeFetch` (`n8n.ts`). Não expor `AUTH_PEPPER`. Não alterar `REGISTRATION_CODE`. |

**Restrições de segurança (REQ-016, DEC-006, DEC-012):**
- NÃO alterar `REGISTRATION_CODE` (`GEOS2026`).
- NÃO expor `AUTH_PEPPER` em logs ou outputs.
- NÃO modificar `.env` ou `.data/portal.db`.
- Manter identidade GWG.
- `N8N_URL` fixo (`localhost`) não requer `safeFetch` para CRUD interno; quando URL é configurável (externa), usar `safeFetch`.

---

### 2.9 Auditoria (REQ-015 / AC-015)

| ID | Requisito | Detalhes e Restrições |
|---|---|---|
| RF-40 | Registro de ações (`AuditEntry`) | `id`, `at` (ISO), `actor_id`, `actor_name`, `actor_role`, `action` (texto), `entity` (`tarefa`/`controle`/`usuário`/etc.), `entityId`, `before`, `after`, `reason` (opcional). Inserção via `logAudit` após cada mutação. |
| RF-41 | Listagem de auditoria | `listAuditFn`: retorna ordenado por `seq DESC`. Requer `audit.read`. Conta total (`auditCount`). |
| RF-42 | Histórico por tarefa | `taskHistoryFn`: filtra `audit` por `entity === "tarefa"` e `entityId === taskId`. Visível no diálogo da tarefa. |

**Entidades auditáveis:** usuário, tarefa, coluna, controle, evidência, módulo, risco, wiki, documento legal, sessão (falha/sucesso), perfil (`avatarUrl`), papel (`role`).

---

### 2.10 Perfil Público e Equipe (REQ-003 / AC-016 / AC-023)

| ID | Requisito | Detalhes e Restrições |
|---|---|---|
| RF-43 | Perfil público (`/perfil/$userId`) | `getPublicUserFn`: retorna `PublicUser` (`name`, `email`, `role`, `jobTitle`, `department`, `bio`, `avatarUrl`, `functions`). Se `userId` inexistente → `throw notFound()`. Se `me.id === userId` → exibe CTA "Editar meu perfil". |
| RF-44 | Atualização de perfil (`updateProfileFn`) | `avatarUrl` (base64 PNG, max ~1.5MB). Zod valida `startsWith("data:image/png;base64,")`. Se arquivo > 1.5MB → rejeita. Se `avatarUrl` removido (`null`) → `avatar_url = NULL` no banco. Gera auditoria (`"Perfil atualizado"`). |
| RF-45 | Equipe (`/equipe`) | `TeamMember`: `name`, `group` (`projeto`/`engenharia`), `role` (cargo em inglês), `area`, `photo`, `bio` (apenas `lead`/`secondary`), `fronts`, `badge` (`crown`/`star`), `tier` (`lead`/`secondary`/`member`), `primaryContact`, `email`, `channels` (`whatsapp`/`email`/`meeting`). Sem dados imaginados (`RNF13`). |
| RF-46 | Fotos de equipe (4:3) | `PHOTO_ASPECT_CSS` (`aspect-[4/3]`) com `object-cover`. `cropTo43` preserva `HEADROOM = 0.3` (não corta linha do cabelo). Fotos sincronizadas por `photos:sync`. Não são circulares (`Avatar` quadrado com borda arredondada, não círculo). |

---

### 2.11 Administração e RBAC (REQ-003 / REQ-013 / AC-012 / AC-013)

| ID | Requisito | Detalhes e Restrições |
|---|---|---|
| RF-47 | Administração (`/admin`) | `listUsersFn`: retorna `PublicUser[]` com `functions`. `setUserRoleFn`: altera `role` (`admin`/`diretor`/`gestor`/`desenvolvedor`/`auditor`/`visualizador`/`cliente`). Se `target.role === "admin"` → rejeita se `admins.length <= 1`. Gera auditoria. |
| RF-48 | Funções concedidas (`grantUserFunctionFn` / `revokeUserFunctionFn`) | Admin concede/revoga funções individuais (`functionKey`). Só concede se `func` existe em `roleFunctionsData`. Gera auditoria. |
| RF-49 | Filtro de páginas (`AppSidebar`) | Oculta itens sem permissão (`userCan(role, permission)`). Cada página (`/tarefas`, `/automacoes`, `/admin`, etc.) revalida no servidor (`auth.requirePermission`). Acesso direto sem permissão retorna `403` ou redireciona. |
| RF-50 | Promoção de admin (`promoteSelfFn`) | Se `admins.length === 0`, qualquer usuário autenticado pode se promover para `admin`. Se já existe admin → rejeita (`"Já existe um administrador no sistema."`). Gera auditoria (`"Auto-recuperação de admin"`). |
| RF-51 | Deleção de usuário (`deleteUserFn`) | Admin não pode deletar a própria conta. Se `target.role === "admin"` → rejeita se `admins.length <= 1`. Gera auditoria (`"Conta removida"`). |

**Matriz RBAC (`rbac.ts`):** `admin` → todas; `diretor` → quase todas (`admin.manage` limitado?); `gestor` → `task.*`, `evidence.*`; `desenvolvedor` → `task.create` (se concedida), `task.move`, `task.comment`; `auditor` → `audit.read`, visualização completa, sem editar; `visualizador` → apenas leitura; `cliente` → `task.read` (futuro), `task.comment` limitado.

---

### 2.12 Analytics de Comportamento (REQ - Analytics / `docs/ANALYTICS.md`)

| ID | Requisito | Detalhes e Restrições |
|---|---|---|
| RF-52 | Coleta pseudonimizada (`/api/track`) | Eventos (`page_view`, `click`, `scroll_depth`, `search`, `form_submit`, `task_open`/`create`/`move`, `login`/`logout`, `error`, `export`/`download`, `custom`). Sem PII (nome, e-mail, CPF, senha, conteúdo de inputs). `anon_id` (`localStorage`), `session_id` (`sessionStorage`). IP mascarado (`SHA-256` com sal `ANALYTICS_IP_SALT`). Respeita `navigator.doNotTrack` e `localStorage["zaggo.analytics.optout"]`. |
| RF-53 | Pipeline de analytics (`Kafka` → `Spark` → `PostgreSQL`) | `Kafka` (3.9, KRaft, 3 partições, retenção 7 dias). `Spark Structured Streaming` (`spark` 3.5): deduplicação, agregação, upsert. `PostgreSQL` 16 (`analytics.events`, `metrics_1m`, `clicks_1m`, views). `Apache Zeppelin` (0.11, dashboard `ZAGGO — Comportamento em Tempo Real`). |
| RF-54 | Painel Analítico (`/analytics`) | Acesso restrito (`admin`, `diretor`, `gestor`, `auditor`). Mostra KPIs, série por minuto, top páginas, cliques, funil 24h, sessões/minuto, sessões por papel, usuários autenticados (pseudônimo). Atualiza a cada 10s (`GET /api/analytics/summary?minutes=60`). Cache 8s. |
| RF-55 | Retenção e privacidade (`LGPD`) | Retenção: eventos brutos > 30 dias apagados (`job` diário); agregados > 400 dias apagados. `analytics-fallback.ndjson` (rotação 64MB) se `Kafka` indisponível. Nenhum dado pessoal exposto no painel. `user_id` e `role` resolvidos no servidor (cookie `geos_session`). |
| RF-56 | Segurança da stack analítica | `Kafka`, `Spark`, `Zeppelin` vinculados a `127.0.0.1` (não expostos na internet). Acesso por túnel SSH. `Zeppelin` com autenticação `Shiro/SHA-256`. `STORAGE_REQUIRE_PERSISTENT=1` falha explicitamente se disco não gravável (não degrada para memória silenciosamente). |

---

### 2.13 Login Logger (REQ-018)

| ID | Requisito | Detalhes e Restrições |
|---|---|---|
| RF-57 | Registro de tentativas de login | `logLoginAttempt`: arquivo `logs/login-attempts.jsonl` (`node:fs`). Linha JSON com `ts` (ISO), `email`, `ip` (`getRequestIP` com `xForwardedFor: true`), `outcome` (`success`/`failure`/`rate_limited`/`error`), `reason`, `error`. Registra mesmo para falhas (`user_not_found`, `invalid_password`). |

---

### 2.14 Persistência e Diagnóstico (REQ-017 / AC-021)

| ID | Requisito | Detalhes e Restrições |
|---|---|---|
| RF-58 | Drivers de persistência | Ordem de fallback: 1. `Postgres` (`POSTGRES_URL`); 2. `Turso` (`TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`); 3. `D1` (binding); 4. `SQLite` arquivo (`DATABASE_PATH` ou `.data/portal.db`); 5. `SQLite` memória (`:memory:`); 6. `MemoryStorage`. |
| RF-59 | Diagnóstico de persistência (`storageDiagnosticFn`) | Endpoint `GET` (requer `admin.manage`). Retorna `env` (`POSTGRES_URL`, `TURSO_DATABASE_URL`, `DATABASE_URL`, `STORAGE_REQUIRE_PERSISTENT`, etc.), `postgresOpenError`, `tursoOpenError`, `storage` (`kind`, `persistent`, `path`, `initError`). |
| RF-60 | Backup e restauração | `exportDatabaseFn` (admin) → JSON completo (`database_dump`). `importDatabaseFn` → restaura. `last_backup_at` em `meta`. Automático via `storage.exportDatabase()` / `importDatabase()`. |
| RF-61 | Persistência obrigatória (`STORAGE_REQUIRE_PERSISTENT=1`) | Se `getStorage()` não abre driver persistente (`persistent: false`) → retorna `500` com aviso (`"Disco não gravável — dados voláteis"`). Sem `STORAGE_REQUIRE_PERSISTENT`, degrada para memória silenciosamente (`persistent: false`). |

---

### 2.15 Design Visual e Identidade GWG (DEC-009 / DEC-014 / DEC-016 / AC-017 / AC-024)

| ID | Requisito | Detalhes e Restrições |
|---|---|---|
| RF-62 | Identidade visual (`ZAGGO`) | Logo `/zaggo-logo.png`. Mark (`/zaggo-mark.png` — quadrado branco + monograma). Wordmark (`/zaggo-wordmark.png` — palavra isolada, sem rodapé). Cores: `--brand` (`oklch(0.54 0.19 218)` ~ `#0868D7`), `--sidebar` (`oklch(0.11 0.06 255)` — azul-marinho profundo). Fontes: `Manrope` (títulos) + `Nunito Sans` (corpo). |
| RF-63 | Login (`/login`) — 2 painéis | Painel institucional (~61%): logo `zaggo-logo.png`, título institucional com destaque azul. Painel de acesso (~39%): apenas método tradicional (`e-mail` + `senha`). Sem botão de provedor externo (`Microsoft`). Seletor `PT`/`EN` demonstrativo. Rodapé `"GWG"` em negrito. |
| RF-64 | Painel executivo (`/`) — 6 KPIs (`StatCard`) | `StatCard` com valores derivados de `tasks`, `modules`, `milestones`, `risks`: progresso geral (`done/total` %), tarefas concluídas, em andamento, aguardando aprovação (`waiting_client`), próxima entrega (`getNextMilestone`), riscos abertos. `DonutChart` para progresso. `StatusTag` real (`success`/`warning`/`danger`). |
| RF-65 | Sidebar (`AppSidebar`) | Logo `/zaggo-mark.png` + nome `"GRUPO GWG"`. Itens preservados: Painel, Tarefas, Automações, Diário, Compliance, Wiki, Riscos, Engenharia, Perfil, Auditoria, Termos, LGPD, Admin. Item ativo com fundo `#0868D7` (`brand`). Rodapé `"© 2026 GRUPO GWG — Solução desenvolvida pelo GWG — GEOCIÊNCIAS APLICADAS E TECNOLOGIAS — UFV"`. |
| RF-66 | Componentes reutilizáveis (`StatCard`, `StatusTag`, `Avatar`, `PanelCard`, `SectionHeader`, `DonutChart`, `ActionBar`) | Usam tokens de `src/styles.css`. `Avatar`: quadrado (`aspect-[4/3]`), não circular. `StatusTag`: `success` (verde), `warning` (âmbar), `danger` (vermelho), `info` (azul), `brand` (marca). `PanelCard`: card com borda arredondada, sombra leve, fundo `card`. |
| RF-67 | Acessibilidade | Contraste `AA`/`AAA`. Cores com `oklch`. Fontes legíveis. Componentes com `aria-label`. |

---

## 3. Requisitos Não Funcionais (RNF)

### 3.1 Arquitetura e Stack (DEC-001 / DEC-002 / DEC-003 / DEC-004)

| ID | Requisito | Detalhes e Restrições |
|---|---|---|
| RNF-01 | Stack tecnológica | Frontend: `React 19` + `TanStack Start` (router, start, query). Backend: `Nitro` / `TanStack server functions` (`createServerFn`). Persistência: `SQLite` (`node:sqlite` — sem dependências nativas), `Postgres` (`pg` / Neon), `Turso` (`@libsql/client`), `D1` (Cloudflare), `MemoryStorage`. Autenticação: cookie `httpOnly` (`geos_session`). Hash: `Argon2id` (`@noble/hashes`) + `pepper` (`AUTH_PEPPER`). Type System: `TypeScript 5.8`. Testes: `Vitest`. Build: `Vite` + `TypeScript`. |
| RNF-02 | Persistência como padrão (`SQLite`) | `SqliteStorage` como padrão local (`.data/portal.db`). `PostgresStorage` para produção (`POSTGRES_URL`). `MemoryStorage` como fallback final (`DEC-003`). `SqliteStorage` abre arquivo persistente ou memória (`:memory:`) se `STORAGE_REQUIRE_PERSISTENT=0`. |
| RNF-03 | Cookie opaco (`token aleatório`) vs JWT (`DEC-004`) | Token opaco (`256 bits`) + `SHA-256` no banco. Permite revogação (`deleteSession`). `JWT` rejeitado (stateless, sem revogação fácil). Cookie `httpOnly`. |
| RNF-04 | Pepper para `Argon2id` (`DEC-005`) | `AUTH_PEPPER` via `process.env` ou `meta` no banco. `verifyPassword` inclui `pepper`. Aumenta segurança se banco vazar (`keyed hashing`). |

---

### 3.2 Segurança e Privacidade (DEC-005 / DEC-006 / DEC-012 / DEC-013 / DEC-015 / AC-021)

| ID | Requisito | Detalhes e Restrições |
|---|---|---|
| RNF-05 | Autenticação segura (`timing-safe`) | `loginFn`: `targetHash = user?.passwordHash ?? c.pw.getDummyPasswordHash()`. `verifyPassword` executa mesmo para usuário inexistente. `registerFailure` para rate limit (`key = requestKey("login", email)`). `clearFailures` após sucesso. `logLoginAttempt` registra falhas (`user_not_found`/`invalid_password`) e sucessos. |
| RNF-06 | Rate limit (`requestKey`) | Chaves por ação (`reg`, `login`, etc.). `isRateLimited(key)`: bloqueia após muitas falhas. `registerFailure(key)`: incrementa contador. `clearFailures(key)`: reseta após sucesso. |
| RNF-07 | Proteção contra SSRF (`n8nFetch`) | `validateN8nUrl` (`allowedHosts` fixo: `localhost`, `127.0.0.1`). `isBlockedIp` rejeita `0.0.0.0`, `169.254.*`, etc. `safeFetch` valida antes de `fetch`. `n8nFetch` não valida URL para `localhost` (fixo e seguro por definição); para URLs configuráveis, usa `safeFetch`. |
| RNF-08 | Menor privilégio (`RBAC`) | `userCan(role, permission)`: matriz `rbac.ts`. `AppSidebar` oculta itens sem permissão (`can(role, permission)`). `createFileRoute` usa `auth.requirePermission` no handler. `createTaskFn`, `addCommentFn`, `updateTaskFn`, `moveTaskFn` revalidam permissão (`task.create`, `task.move`, `task.approve`, `task.comment`). `deleteUserFn` exige `admin.manage`. `grantUserFunctionFn` exige `admin.manage`. |
| RNF-09 | Senhas fortes (`registerFn`) | `password`: min 8 chars, max 200 chars. Requer `A-Z`, `a-z`, `0-9`, caractere especial (`/[^A-Za-z0-9]/`). `hashPassword` (`Argon2id`, `salt` 16 bytes hex, `pepper` global). `verifyPassword` compara `hash` com `pepper`. |
| RNF-10 | Senha temporária (`Temp12345!`) — RISCO CONFIRMADO (`DEC-012`, `PLANEJAMENTO-PORTAL-ZAGGO.md`) | `provisionN8nUser` usa senha temporária visível (`"Temp12345!"`). **Requisito de correção:** remover constante; usar token SSO (`N8N_SSO_SECRET`) ou senha do usuário (`password` do portal) via `email.auth-handler.js`. `register-server.js` (`porta 3456`) aceita `email`, `password`, `firstName`, `lastName`. Se `token` opcional (`JWT`) for fornecido, criar com senha aleatória interna. |
| RNF-11 | Cookie de sessão compartilhado (`SSO`) — NÃO IMPLEMENTADO (`DEC-013`, `DEC-016`) | Sem mecanismo de cookie/sessão compartilhado entre portal (`portal.163.176.45.217.sslip.io`) e n8n (`163-176-45-217.sslip.io`). **Solução proposta:** proxy same-origin (`/n8n/*`) + middleware de token (`N8N_SSO_SECRET`, expiração 5 min). `email.auth-handler.js` já valida no Postgres portal (`argon2id` + `pepper`). Se usuário existe no portal, cria/encontra no n8n (`bcrypt`). `provisionN8nUser` deve ser removido ou substituído por `register-server.js` com `token`. |
| RNF-12 | Iframe seguro (`X-Frame-Options`, `CSP`) | `n8n-custom` envia `X-Frame-Options: SAMEORIGIN`. Se `N8N_PUBLIC_URL` é `https://...`, o iframe é cross-origin (`portal` vs `n8n`). **Solução proposta (`DEC-013`, `DEC-006`):** configurar proxy reverso (`vite.config.ts` ou `nginx/traefik`) para rotear `/n8n/*` → container `n8n-recipe` (`5678`), mesma origem. Remover/sobrescrever `X-Frame-Options` no proxy. Adicionar `CSP` `frame-ancestors 'self'`. Manter `N8N_URL` (`127.0.0.1:5679`) para API interna do portal (`n8nFetch`). |
| RNF-13 | Dados sem imaginação (`RNF13`) | `TeamMember`: `name`, `group`, `role` (inglês real — ex.: `Lead Engineer`), `area` (`Geociências`), `photo` (`public/team/*.png`), `bio` (apenas se `tier` é `lead`/`secondary`), `channels` (vazio até dado real chegar). Nenhum dado inventado. `team-catalog.ts` casa foto por `slug` (exato → primeiro + último → primeiro nome único). Nome ambíguo devolve `undefined` (inicial, não foto de outra pessoa). |
| RNF-14 | Não expor `.env` ou `.data/` (`DEC-008`) | `README.md` e `docs/ci-cd.md` confirmam: `AUTH_PEPPER` não exposto em logs ou outputs de build. `REGISTRATION_CODE` (`GEOS2026`) não alterado. Nenhum arquivo de produção (`.env`, `.data/portal.db`) modificado em correções. |

---

### 3.3 Performance e Escalabilidade (`docs/ANALYTICS.md`, `docs/ci-cd.md`, `README.md`)

| ID | Requisito | Detalhes e Restrições |
|---|---|---|
| RNF-15 | Performance SQLite | `SqliteStorage` usa `node:sqlite` (sem dependências nativas). Impacto negligenciável para <10k tarefas (`ALTER TABLE` adiciona `stage` `TEXT`, `progress` `INTEGER`, `responsible` `TEXT`, `waiting_on_client` `INTEGER`). `SCHEMA` atualizado (`CREATE TABLE IF NOT EXISTS tasks`) para incluir novas colunas. |
| RNF-16 | Build (`Vite` + `TypeScript`) | `npm run build` gera `.output/`. `npm run dev` usa `vite.config.ts` (proxy `/n8n`). `bun run typecheck` (`TypeScript 5.8`) — 0 erros NOVOS. `bun run test` — 248 PASS (`236` originais + `12` novos: `zaggo-redesign`). `npx eslint` — 0 erros nos arquivos do escopo. |
| RNF-17 | Deploy (`Vercel` / `Nitro` / `Docker`) | `vercel.json`: `NITRO_PRESET=vercel`. `Framework: Vite` | `Build: npm run build` | `Output: .output/public`. `DATABASE_PATH=/tmp/portal.db` (SQLite em memória — sem disco persistente). `AUTH_PEPPER` (`openssl rand -base64 32`), `REGISTRATION_CODE` (`GEOS2026`), `STORAGE_REQUIRE_PERSISTENT=1`. `Docker` para analytics (`Kafka`, `Spark`, `Zeppelin`, `PostgreSQL`). `docker-compose.analytics.yml`. `docker-compose.db.yml` para `portal-postgres`. |
| RNF-18 | Resiliência (`fallback` analítico) | Se `Kafka` indisponível (`Kafka unhealthy`), portal grava `NDJSON` local (`.data/analytics-fallback.ndjson`, rotação 64MB). Responde `204`. Arquivo não reenviado automaticamente — requer `kafka-console-producer` para reprocessar. Se `Postgres` indisponível (`postgresOpenError`), `analytics-db-init` reinicia (`docker-compose analytics-db-init`). Se `Spark` reinicia (`job reiniciando`), `spark_checkpoints` volume preserva estado (`ON CONFLICT`). Se volume `spark_checkpoints` corrompido (`FileNotFoundException: ... .delta does not exist`), limpar volume e recriar stack. |
| RNF-19 | Escala (`Analytics`) | `Kafka`: aumentar partições (`portal.events`). `Spark`: subir mais workers (`--cores` / `--memory`). Trocar `approx_count_distinct` por contagem exata em batch. Portal não precisa de mudança (`/api/track` só publica). `Zeppelin` (`Shiro`) com senha em `.env.analytics` (`ZEPPELIN_ADMIN_PASSWORD`). `Spark` (`Master UI`: `127.0.0.1:8081`; `Worker UI`: `127.0.0.1:8082`). |

---

### 3.4 Manutenibilidade e Documentação (`spec/`)

| ID | Requisito | Detalhes e Restrições |
|---|---|---|
| RNF-20 | Documentação de requisitos (`spec/`) | `spec/requirements.md`: `REQ-001` a `REQ-019` (19 requisitos). `spec/specification.md`: stack, interfaces (`Storage`, `Auth`, `N8n`, `Portal API`, `Context`), drivers (`SqliteBackend`, `MemoryStorage`, `SqliteStorage`, `D1Storage`, `PostgresStorage`). `spec/acceptance-criteria.md`: `AC-001` a `AC-024` (critérios de aceitação por requisito). `spec/decisions.md`: `DEC-001` a `DEC-016` (decisões arquiteturais). `docs/ANALYTICS.md`: pipeline, componentes, segurança, operação, troubleshooting. `docs/ci-cd.md`: quality gate (`typecheck`, `test`, `build`, `lint`), deploy (`pm2`, `vercel`, `docker-compose`). |
| RNF-21 | Testes obrigatórios (`TDD`) (`DEC-007`) | `RED` → `GREEN` → `REFACTOR`. Testes existentes (`src/server/__tests__/`: `auth-functions`, `auth`, `storage`, `passwords-helpers`, `n8n-http`, `n8n-login-flow`, `context`, `team-catalog`, `zaggo-redesign`, `equipe-utils`, `diario-logbook`, etc.). Novos testes (`zaggo-redesign.test.ts` — 12 PASS). `npx eslint` escopo: `src/server/n8n.ts`, `src/lib/portal-api.ts`, `src/routes/automacoes.tsx`, `src/server/__tests__/*.test.ts`. |
| RNF-22 | Migração aditiva (`DEC-014`) | `updateTaskStageProgress`: `ALTER TABLE tasks ADD COLUMN stage TEXT; progress INTEGER DEFAULT 0; responsible TEXT DEFAULT ''; waiting_on_client INTEGER DEFAULT 0;`. Nenhuma linha removida. `updatedAt` atualizado. `SCHEMA` atualizado (`CREATE TABLE IF NOT EXISTS tasks`). `Task` (`src/data/types.ts`) estendido (`stage`, `progress`, `responsible`, `waitingOnClient`). `portal-api.ts`: `createTaskFn` aceita `stage`/`progress`/`responsible`; `moveTaskFn` atualiza `stage`/`waiting_on_client` conforme destino; `updateTaskFn` aceita `progress`/`responsible`. `task-stages.ts`: `CLIENT_STAGES`, `stageLabel`, `stageTone`, `columnToStage`, `stageToColumn`, `inferProgressFromStage`, `isWaitingOnClient`. |
| RNF-23 | Não reescrever histórico git (`AGENTS.md`) | Evitar `force push`, `rebase`, `amend`, `squash` em commits já enviados (`Lovable`). Manter `main` em estado funcional (`branch` sincroniza com `Lovable`). `npm run build` gera `.output/`; não modifica `.env` ou `.data/`. |

---

### 3.5 Usabilidade e Experiência (`DEC-009`, `DEC-014`, `DEC-016`, `PLANEJAMENTO-PORTAL-ZAGGO.md`)

| ID | Requisito | Detalhes e Restrições |
|---|---|---|
| RNF-24 | Tarefas visuais (5 etapas) (`PLANEJAMENTO-PORTAL-ZAGGO.md`, Parte A) | `not_started` (cinza/slate), `in_progress` (azul), `waiting_client` (âmbar/laranja — `animate-pulse`), `review` (roxo), `done` (esmeralda). Card: barra de progresso (`width: ${t.progress}%`), responsável (`t.responsible || t.assignee`), prazo (`due`: `vencido` vermelho, `hoje` âmbar, futuro neutro), prioridade (`border-l-[4px]`), tags (`tags`), selo `"⚡ Aguardando você"` (`bg-amber-500/15`, `text-amber-700`). Board: coluna `"Aguardando você"` com fundo `bg-amber-500/5`. Lista (`view === 'list'`): colunas `Progresso`, `Responsável`, `Etapa` (substitui `Status`), destaque `bg-amber-50` para `waiting_client`. Tabela: filtro `waiting_client`. Widget no topo (`tarefas.tsx`): `"Aguardando você: {filtered.filter(t => t.waitingOnClient).length}"`. |
| RNF-25 | RBAC contextual (`DEC-015`, `DEC-016`) | `cliente`: `task.read`, `task.comment`. `desenvolvedor`: `task.create` (se concedida), `task.move`, `task.comment`. `auditor`: visualização completa, sem editar. `gestor`: `task.create`, `task.move`, `task.approve`, `task.comment`. `admin`: tudo. `visualizador`: apenas leitura. `moveTaskFn`: `waiting_client` requer `responsible` preenchido; se vazio → rejeita (`"Defina o responsável antes de marcar como 'Aguardando você'."`). `createTaskFn`: `waiting_client` exige `responsible`. |
| RNF-26 | Design responsivo e tokens (`DEC-014`) | `styles.css`: `--brand` (`#0868D7`), `--brand-soft`, `--brand-foreground`, `--sidebar` (`#0a1128` ~ azul-marinho profundo). `font-family`: `Manrope` (`font-extrabold`) + `Nunito Sans`. Componentes (`StatCard`, `StatusTag`, `Avatar`, `PanelCard`, `SectionHeader`, `DonutChart`, `ActionBar`) consomem tokens. `Avatar`: `aspect-[4/3]` (não círculo), `h-*` (altura definida, largura via `aspect-ratio`). `PHOTO_ASPECT_CSS` (`aspect-[4/3]`) + `object-cover`. `cropTo43` (`HEADROOM = 0.3`). `public/team/*.png`: fotos reais (`team-catalog`). `avatarUrl` (base64 PNG, max 512px, `aspect-ratio` preservado). |

---

## 4. Restrições e Limitações Confirmadas

| ID | Restrição / Limitação | Fonte e Status |
|---|---|---|
| LMT-01 | **Iframe `n8n` bloqueado (`X-Frame-Options: SAMEORIGIN`)** | `docs/ANALYTICS.md`, `PLANEJAMENTO-PORTAL-ZAGGO.md` (Parte B). `curl` confirma. **Status:** diagnóstico confirmado; solução (`proxy same-origin` `/n8n/*`) documentada (`DEC-013`, `DEC-006`). |
| LMT-02 | **Login unificado (`SSO`) não implementado (`cookie` compartilhado)** | `PLANEJAMENTO-PORTAL-ZAGGO.md` (Parte C), `DEC-012`, `DEC-013`. `email.auth-handler.js` já valida `argon2id` + `pepper`. `provisionN8nUser` usa senha temporária (`Temp12345!`). **Status:** Fase 1 (`remover senha temporária`) é imediato; Fase 2 (`token SSO`) é médio prazo; Fase 3 (`automação completa`) é longo prazo. |
| LMT-03 | **Senha temporária (`Temp12345!`) exposta (`provisionN8nUser`)** | `PLANEJAMENTO-PORTAL-ZAGGO.md`, `DEC-012`. **Status:** risco de segurança imediato; primeira ação (`C. Fase 1`) é remover constante e usar `token` (`N8N_SSO_SECRET`) ou senha do usuário (`password` do portal). `register-server.js` (`porta 3456`) aceita `token` opcional. |
| LMT-04 | **Nenhum arquivo de produção alterado (`.env`, `.data/portal.db`)** | `DEC-008`, `README.md`. `AUTH_PEPPER` (`openssl rand -base64 32`) não exposto. `REGISTRATION_CODE` (`GEOS2026`) não alterado. `STORAGE_REQUIRE_PERSISTENT=1` falha se `persistent: false`. `DATABASE_PATH=/tmp/portal.db` (`Vercel` — memória). `DATABASE_PATH=.data/portal.db` (local — persistente). `backup` automático (`exportDatabase`/`importDatabase`). `last_backup_at` em `meta`. |
| LMT-05 | **Dados sem imaginação (`RNF13`)** | `spec/acceptance-criteria.md` (`AC-024`), `PLANEJAMENTO-PORTAL-ZAGGO.md`. `TeamMember`: `name`, `group`, `role` (inglês real), `area`, `photo` (`public/team/*.png`), `bio` (apenas `lead`/`secondary`), `channels` (vazio até dado real). Nenhum dado inventado (`team-catalog`). |
| LMT-06 | **Não alterar `.env` ou modificar `.data/`** | `DEC-008`, `README.md`, `docs/ci-cd.md`. `postinstall` (`patch-unenv.mjs`) mantido. Nenhum arquivo de produção alterado em correções ou implementações. `spec/` e `graph/` criados do zero (`DEC-009`). `map` de requisitos diretamente de `src/` (`DEC-009`). |
| LMT-07 | **Identidade `GWG` preservada (`DEC-009`, `DEC-014`)** | `public/zaggo-logo.png` (`1254x1254`). Derivados: `zaggo-wordmark.png` (palavra, sem rodapé), `zaggo-mark.png` (monograma, fundo branco quadrado). `favicon.ico` (`16/32/48/64`), `apple-touch-icon.png` (`180`). `AppSidebar`: `/zaggo-mark.png` + `"GRUPO GWG"`. Login: `logo` (`zaggo-logo.png`) + título institucional (`"GRUPO GWG — GEOCIÊNCIAS APLICADAS E TECNOLOGIAS — UFV"`). `public/assets/wiki.*`: sem alteração. `docs/ANALYTICS.md`: sem alteração de conteúdo técnico. `spec/` não existente no original (`DEC-009`). |
| LMT-08 | **Nenhuma tela lê `src/data` em runtime (`getPortalStateFn`)** | `README.md` (linha 91). `tasks`, `columns`, `controls`, `modules`, `risks`, `wiki`, `milestones`, `releases`, `patentStages`, `techStack`, `nextSteps`, `legalDocs` vêm de `Storage` (`getStorage()` / `list*`). `src/data` só semente inicial. `getPortalStateFn` retorna `PortalStatePayload` (`persistent`, `tasks`, `columns`, `controls`, `comments`, `evidences`, `modules`, `risks`, `wiki`, `milestones`, `releases`, `journal`, `patentStages`, `techStack`, `nextSteps`, `legalDocs`, `auditCount`, `docs`). |
| LMT-09 | **Data `ISO` (`YYYY-MM-DD`)** | `nextSteps.due`, `legalDocs.publishedAt`, `milestones`/`releases` (`date`), `patentStages.deadline` (`YYYY-MM-DD`). `formatBR` (`dd/mm/aaaa`) para exibição. `isFutureISO` (`new Date(...) >= new Date()`). `zod` valida (`isoDateSchema`). `addMonthsBR` (`lastReview` + 6 meses = `nextReview`). `fmtBR` (`formatBR`). |
| LMT-10 | **Build e deploy (`Vercel`, `Nitro`)** | `README.md`: `Deploy na Vercel` (`Fork LucasBorges4`). `vercel.json`: `NITRO_PRESET=vercel`. `Framework: Vite` | `Build: npm run build` | `Output: .output/public`. `Env vars`: `DATABASE_PATH=/tmp/portal.db` (memória — sem persistência), `AUTH_PEPPER`, `REGISTRATION_CODE`, `STORAGE_REQUIRE_PERSISTENT=1`, `N8N_URL`, `N8N_PUBLIC_URL`, `N8N_API_KEY`. `docs/ci-cd.md`: `Quality Gate` (`typecheck` 0 erros NOVOS, `test` 248 PASS, `build` PASS, `lint` 0 erros no escopo). `pm2 restart recipe-plan-studio` (`porta 3001`, `nginx TLS`). `docker-compose -f docker-compose.n8n.yml up -d` (`n8n-recipe`, `n8n-custom-geos:latest`, volume `n8n_recipe_data`). `docs/ANALYTICS.md`: `npm run analytics:setup` (`.env.analytics` + `shiro.ini`), `npm run analytics:up` (`Kafka`, `Spark`, `Zeppelin`, `schema analytics`), `npm run deploy` (`portal` com `/api/track` + `/analytics`), `npm run analytics:demo` (eventos sintéticos). `npm run analytics:status` / `logs` / `down`. |
| LMT-11 | **Relatórios (`reports/`) e cobertura (`coverage/`)** | `reports/01-code-review-findings.md`, `02-improvement-report.md`, `03-rebranding-deploy.md`, `04-n8n-functional.md`, `05-avatar.md`, `06-team-avatar.md`, `07-zaggo-redesign.md`. `coverage/lcov-report/recipe-plan-studio/src/routes/admin.tsx.html`: `Valide os pré-requisitos antes da implantação.` `coverage/recipe-plan-studio/src/routes/admin.tsx.html`: `Valide os pré-requisitos antes da implantação.` `spec/acceptance-criteria.md`: `AC-024`: `Identidade GWG, login tradicional e fotos em 4:3` (`aspect-[4/3]`, `cropTo43`, `HEADROOM = 0.3`, `PHOTO_ASPECT_CSS`). `spec/decisions.md`: `DEC-014`: `Tokens visuais ZAGGO centralizados em src/styles.css`. `DEC-015`: `Role cliente: apenas task.comment`. `DEC-016`: `Ocultar UI por permissão + gate de página + revalidação no servidor`. `DEC-009`: `Arquivos spec/ e graph/ criados do zero`. `DEC-008`: `Não alterar .env ou .data/portal.db`. `DEC-007`: `TDD obrigatório antes de correção`. `DEC-004`: `Cookie opaco (token aleatório)`. `DEC-003`: `MemoryStorage como fallback final`. `DEC-002`: `PostgresStorage estende SqliteBackend`. `DEC-001`: `SQLite como driver principal`. `DEC-012`: `Provisão via /rest/register (porta 3456)`. `DEC-011`: `Correção de paths n8n (n8n 2.17.7)`. `DEC-010`: `postinstall (patch-unenv.mjs)`. `DEC-013`: `Iframe HTTPS e CSP`. `DEC-006`: `N8n via fetch direto com X-N8N-API-KEY`. `DEC-005`: `Pepper para Argon2id`. |

---

## 5. Fontes e Referências do Projeto

- `README.md` (linha 1-92): descrição do projeto, build, deploy, backend/autenticação, analytics, operação.
- `AGENTS.md`: instruções `Lovable` (`force push`, `rebase`, `amend`, `squash` proibidos).
- `docs/ANALYTICS.md`: pipeline (`Kafka` → `Spark` → `PostgreSQL` → `Zeppelin`), segurança (`LGPD`), operação (`analytics:setup`/`up`/`down`/`status`/`logs`/`demo`).
- `docs/ci-cd.md`: `Quality Gate` (`typecheck`, `test`, `build`, `lint`), deploy (`pm2`, `nginx TLS`, `vercel`), `REGISTRATION_CODE` (`GEOS2026`), `AUTH_PEPPER`.
- `spec/requirements.md`: `REQ-001` a `REQ-019`.
- `spec/specification.md`: stack, interfaces (`Storage`, `Auth`, `N8n`, `Portal API`, `Context`), drivers (`SqliteBackend`, `MemoryStorage`, `SqliteStorage`, `D1Storage`, `PostgresStorage`).
- `spec/acceptance-criteria.md`: `AC-001` a `AC-024`.
- `spec/decisions.md`: `DEC-001` a `DEC-016`.
- `PLANEJAMENTO-PORTAL-ZAGGO.md`: planejamento técnico (`Parte A`: tarefas visuais; `Parte B`: proxy `n8n`; `Parte C`: `SSO` / login unificado).
- `src/lib/portal-api.ts`: `registerFn`, `loginFn`, `logoutFn`, `meFn`, `getPortalStateFn`, `createTaskFn`, `moveTaskFn`, `updateTaskFn`, `addCommentFn`, `attachEvidenceFn`, `reviewEvidenceFn`, `reviewControlFn`, `createRiskFn`, `updateRiskFn`, `deleteRiskFn`, `generateAutoRisksFn`, `addModuleFn`, `removeModuleFn`, `setUserRoleFn`, `grantUserFunctionFn`, `revokeUserFunctionFn`, `promoteSelfFn`, `deleteUserFn`, `updateProfileFn`, `getPublicUserFn`.
- `src/lib/rbac.ts`: `Role` (`admin`/`diretor`/`gestor`/`desenvolvedor`/`auditor`/`visualizador`/`cliente`), `RoleProfile`, `RoleFunction`, `Permission`, `userCan`, `getEffectivePermissions`, `movePermission`, `defaultRoleForNewUser`, `defaultPermissions`, `roleFunctionsData`.
- `src/lib/task-stages.ts`: `CLIENT_STAGES`, `stageLabel`, `stageTone`, `columnToStage`, `stageToColumn`, `inferProgressFromStage`, `isWaitingOnClient`, `STAGE_COLOR_MAP`.
- `src/data/types.ts`: `Module`, `Task`, `Milestone`, `Release`, `ComplianceControl`, `WikiArticle`, `Risk`, `TeamMember`, `ContactChannel`, `TeamMemberContact`, `TeamMemberTier`, `TeamLeaderBadge`, `TeamGroup`, `Attachment`, `TimelineComment`, `TimelineEventKind`, `TimelineEventStatus`, `TimelineEvent`, `JournalComment`, `JournalEntry`, `TechItem`, `PatentStage`, `LegalDoc`.
- `src/server/storage.ts`: `SCHEMA`, `SqliteStorage`, `MemoryStorage`, `Storage` interface, `getStorage()`, `initStorage()`, `getStorageInfo()`, `getStorageInitError()`, `exportDatabaseFn`, `importDatabaseFn`, `listAudit`, `countAudit`, `listTasks`, `listColumns`, `listControls`, `listComments`, `listEvidences`, `listModules`, `listRisks`, `listWiki`, `listMilestones`, `listReleases`, `listJournalEntries`, `listPatentStages`, `listTechStack`, `listNextSteps`, `listLegalDocs`, `listDocs`, `countTasksInColumn`, `getTask`, `getControl`, `getEvidence`, `getInviteByHash`, `getResetTokenByHash`.
- `src/routes/index.tsx`: `Index` (dashboard executivo — KPIs, progresso, próximas entregas, equipe, atividades recentes, pontos de atenção, `ActionBar`).
- `src/routes/admin.tsx`: `Admin` (administração — usuários, módulos, funções, auditoria, backup, checklist publicação, patente 7 etapas, próximo passos, documentos legais).
- `src/routes/automacoes.tsx`: `Automacoes` (`iframe` `n8nPublicUrl`, `getN8nInfoFn`).
- `src/routes/login.tsx`: `Login` (`loginFn`, layout 2 painéis, logo `zaggo-logo.png`, seletor `PT`/`EN`).
- `src/routes/tarefas.tsx`: `Tarefas` (`TaskBoard`, `TaskTable`, `TaskList`, `TaskDialog`, `TaskCard`).
- `src/routes/compliance.tsx`: `Compliance` (`ComplianceControl`, `EvidenceRecord`, `reviewEvidence`).
- `src/routes/riscos.tsx`: `Riscos` (`Risk`, `createRisk`, `updateRisk`, `deleteRisk`, `generateAutoRisks`).
- `src/routes/perfil.tsx`: `Perfil` (`updateProfileFn`, `avatarUrl`, `PublicUser`).
- `src/routes/perfil.$userId.tsx`: `PerfilPublico` (`PublicUser`, `avatarUrl`, `functions`, `teamMemberId`).
- `src/routes/equipe.tsx`: `Equipe` (`TeamMember`, `buildTeamCatalog`, `public/team/*.png`).
- `src/routes/analytics.tsx`: `Analytics` (`DashboardMetrics`, `KPIs`, `/api/analytics/summary`).
- `src/routes/diario.tsx`: `Diario` (`JournalEntry`, `JournalComment`, `TimelineEvent`).
- `src/routes/termos.tsx`: `Termos` (`LegalDoc`, `terms` slug). `src/routes/lgpd.tsx`: `LGPD` (`LegalDoc`, `lgpd` slug). `src/routes/wiki.index.tsx` / `wiki.$slug.tsx`: `WikiArticle`. `src/routes/mentoria.tsx`: `Mentoria`. `src/routes/auditoria.tsx`: `Auditoria` (`AuditEntry`, `listAudit`). `src/routes/automacoes.tsx`: `Automacoes`. `src/routes/admin.tsx`: `Admin`. `src/routes/index.tsx`: `Painel Executivo`.
- `public/zaggo-logo.png` (`1254x1254`), `public/zaggo-wordmark.png`, `public/zaggo-mark.png`, `public/favicon.ico`, `public/apple-touch-icon.png`, `public/assets/wiki.*`. `public/team/*.png`: `team-photos` (`team-catalog`).
- `analytics/postgres/init.sql`: `analytics.events`, `analytics.metrics_1m`, `analytics.clicks_1m`, `analytics.v_*` (`v_live_kpis`, `v_events_per_minute`, `v_top_pages_15m`, `v_click_heatmap_15m`, `v_funnel_24h`, `v_device_breakdown_15m`, `v_role_activity_15m`, `v_user_activity_15m`, `v_slow_pages_15m`).
- `analytics/zeppelin/notebook.json`: `Dashboard` (`ZAGGO — Comportamento em Tempo Real`). `analytics/zeppelin/bootstrap.py`: `init` (`.env.analytics`, `shiro.ini`, `ZEPPELIN_ADMIN_PASSWORD`). `analytics/zeppelin/conf/shiro.ini`: `admin` (`admin`/`password` — `SHA-256` hash). `analytics/spark/Dockerfile`: `Spark 3.5` (`master`/`worker`). `analytics/kafka/Dockerfile`: `Kafka 3.9` (`KRaft`). `analytics/postgres/init.sql`: `SCHEMA` (`analytics.events`, `metrics_1m`, `clicks_1m`).
- `node_modules/.nitro/vite/services/ssr/assets/*.mjs`: `public/assets/*.js` (build). `node_modules/.output/`: `.output/server/_ssr/*.mjs`, `.output/public/assets/*.js`. `node_modules/.nitro/`: `vite.config.ts` proxy (`/n8n` → `http://127.0.0.1:5679`). `node_modules/.nitro/vite/services/ssr/assets/`: `public/assets/*.mjs`.
- `src/lib/api-hooks.ts`: `usePortalData`, `useSession`, `useAuditList`, `usePublicUsers`, `useTaskHistory`, `usePortalState`, `useStorageInfo`, `useStorageDiagnostic`.
- `src/lib/zaggo-helpers.ts`: `calculateOverallPct`, `countCompletedTasks`, `countInProgressTasks`, `countApprovalPendingTasks`, `getNextMilestone`, `countOpenRisks`, `mapRoleToArea` (`admin` → `Direção`, `gestor` → `Gestão`, etc.), `formatAuditTime`, `formatAuditActor`, `formatAuditAction`.
- `components.json`: `shadcn/ui` (`components` — `button`, `dialog`, `label`, `tabs`, `card`, `badge`, `progress`, `avatar`, `separator`, `dropdown-menu`, `sheet`, `scroll-area`, `tooltip`, `popover`). `lucide-react` (`icon` library). `tailwindcss` (`v4`? `v3`? `postcss`? `autoprefixer`?). `react` (`19`). `react-dom` (`19`). `@tanstack/react-router` (`start`, `router`, `query`). `@tanstack/react-query`. `nitro`. `vite`. `typescript`. `zod`. `lucide-react`. `tailwind-merge`. `clsx`. `class-variance-authority`. `radix-ui`. `shadcn/ui`. `manrope`. `nunito-sans`. `google-fonts`. `postcss`. `autoprefixer`. `tailwindcss`. `vite` (`plugin-react`, `plugin-react-swc`?). `bun`. `node`. `sqlite3`? `node:sqlite` (`sqlite` nativo `node:sqlite` — `sqlite` em `node` 22+?). `zod`. `hash-wasm` (`@noble/hashes`? `hash-wasm`?). `argon2` (`hash-wasm`). `crypto.subtle.digest` (`SHA-256`). `crypto.subtle`. `crypto.getRandomValues`. `crypto.randomUUID`. `crypto.subtle.sign`. `crypto.subtle.verify`. `crypto.subtle.importKey`. `crypto.subtle.exportKey`. `crypto.subtle.deriveBits`. `crypto.subtle.deriveKey`. `crypto.subtle.encrypt`. `crypto.subtle.decrypt`. `crypto.subtle.wrapKey`. `crypto.subtle.unwrapKey`. `crypto.subtle.generateKey`. `crypto.subtle.digest` (`"SHA-256"`). `crypto.subtle.digest` (`"SHA-1"`?). `crypto.subtle.digest` (`"SHA-512"`?). `crypto.subtle.digest` (`"SHA-384"`?). `crypto.subtle.digest` (`"SHA-3-256"`?). `crypto.subtle.digest` (`"BLAKE2b-512"`?). `crypto.subtle.digest` (`"BLAKE2b-256"`?).
- `public/assets/*.js`: `analytics/events/*.mjs`? `analytics/*.mjs` (`analytics/dashboard`, `analytics/kpi`, `analytics/funnel`, `analytics/table`, `analytics/summary`). `public/assets/*.mjs`: `public/assets/admin-*.mjs`, `public/assets/analytics-*.mjs` (`analytics/analytics`, `analytics/analytics.mjs`, `analytics/analytics.mjs` — `public/assets/analytics.mjs`? `analytics/analytics.mjs`?).
- `public/assets/*.mjs`: `public/assets/wiki.*.mjs` (`wiki.index`, `wiki.slug`, `wiki`). `public/assets/useStore-*.mjs` (`useStore`, `usePortalData`, `usePublicUsers`, `useSession`). `public/assets/users-*.mjs` (`users`, `user-plus`, `user-plus-3`). `public/assets/calendar-*.mjs` (`calendar`, `calendar-days`). `public/assets/check-*.mjs` (`check`, `check-BBGBNT5-`). `public/assets/chevron-down-*.mjs` (`chevron-down`). `public/assets/circle-check-*.mjs` (`circle-check`). `public/assets/arrow-up-right-*.mjs` (`arrow-up-right`). `public/assets/arrow-right-*.mjs` (`arrow-right`). `public/assets/arrow-left-*.mjs` (`arrow-left`). `public/assets/automacoes-*.mjs` (`automacoes`). `public/assets/auditoria-*.mjs` (`auditoria`). `public/assets/admin-*.mjs` (`admin`). `public/assets/zaggo-wordmark.png`, `public/assets/zaggo-logo.png`, `public/assets/zaggo-mark.png`. `public/assets/funnel-*.mjs`. `public/assets/download-*.mjs`. `public/assets/link-2-*.mjs`. `public/assets/plus-*.mjs`. `public/assets/refresh-cw-*.mjs`. `public/assets/shield-alert-*.mjs`. `public/assets/trash-2-*.mjs`. `public/assets/users-*.mjs`. `public/assets/user-plus-*.mjs`.

---

*Documento gerado automaticamente a partir de varredura completa (`glob` + `read` + `grep`) dos arquivos do repositório (`recipe-plan-studio`). Nenhum arquivo de código foi alterado. Nenhum dado de produção modificado.*
