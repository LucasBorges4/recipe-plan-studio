# PLANEJAMENTO — Portal ZAGGO (GWG): Tarefas Visuais + n8n (iframe + login unificado)

**Documento: APENAS PLANEJAMENTO — NÃO IMPLEMENTA CÓDIGO.**
**Repositório:** `/home/opc/github/ok/recipe-plan-studio`
**Data:** 14/09/2026
**Status:** Planejamento técnico (PT-BR)

---

## Resumo Executivo

O cliente precisa acompanhar visualmente o que a GWG está fazendo (etapas claras, progresso %, responsável, prazo, flag de dependência do cliente). Paralelamente, há dois problemas técnicos confirmados no ambiente n8n: (1) o iframe em `/automacoes` falha com `NetworkError` porque o container `n8n-custom` (porta 5679→5678, 3456) retorna `X-Frame-Options: SAMEORIGIN`, bloqueando a origem do portal (`https://portal.163.176.45.217.sslip.io` vs `https://163-176-45-217.sslip.io`); (2) o login unificado entre portal e n8n ainda expõe uma senha temporária (`"Temp12345!"`) via `provisionN8nUser`, conflitando com o requisito "mesmo login para ambos".

Este plano propõe: **Parte A** (extensão do modelo de tarefas + UI visual com 5 etapas); **Parte B** (correção do bloqueio do iframe via proxy same-origin + ajuste de URLs); **Parte C** (arquitetura de SSO/unificação do login, removendo senha temporária). A ordem recomendada é A → B → C, pois A é independente e de maior impacto no cliente; B e C dependem da mesma infraestrutura de proxy/n8n e devem ser executados em sequência para minimizar downtime.

---

## Parte A — Tarefas Visuais (Experiência do Cliente)

### 1. Modelo de Dados (extensão de `Task` e tabela `tasks`)

**Estado atual verificado:**
- `Task` (`src/data/types.ts`): `{ id, title, description, column, priority, tags, assignee, due?, comments? }`.
- Tabela SQL (`src/server/storage.ts`, ~linha 372): `id, title, description, column_name, priority, tags (json), assignee, due (text), comments`.
- Colunas existentes (`board_columns`): "Backlog", "A Fazer", "Em Progresso", "Em Execução", "Em Aprovação", "Em Revisão", "Concluído" (mapeamento `columnColors` em `tarefas.tsx`).
- Seed existente em `seedIfEmpty`/`seedDocsIfEmpty` (`src/server/storage.ts`).

**RECOMENDO: abordagem de migração aditiva (não destrutiva)** para preservar registros reais e compatibilidade com testes existentes.

**Decisões concretas:**

| Campo novo | Tipo SQL | Tipo TS | Default / Regras | Justificativa |
|---|---|---|---|---|
| `stage` | `TEXT` (novo) | `string` enum | Derivado de `column_name`; se vazio, mapeado para `column_name`. Os valores canônicos são: `not_started` | `in_progress` | `waiting_client` | `review` | `done`. | Separa a etapa visual (cliente) da coluna interna existente. Permite migração gradual. |
| `progress` | `INTEGER` | `number` (0–100) | `DEFAULT 0` | Porcentagem de progresso explícita, independente do stage. |
| `responsible` | `TEXT` | `string` | `DEFAULT ''` | Nome/e-mail do responsável. Se vazio, usa `assignee`. Permite diferenciar "responsável técnico" de "assignee" se no futuro for necessário. |
| `waiting_on_client` | `INTEGER` (0/1) | `boolean` | `DEFAULT 0` | Flag derivada: `true` quando `stage === 'waiting_client'`. Pode ser calculada ou persistida. **RECOMENDO persistir** (`INTEGER DEFAULT 0`) para facilitar filtros rápidos no SQLite e evitar recálculo constante em `listTasks`. |

**Migração proposta (sem perda de dados):**
1. `ALTER TABLE tasks ADD COLUMN stage TEXT;`
2. `ALTER TABLE tasks ADD COLUMN progress INTEGER DEFAULT 0;`
3. `ALTER TABLE tasks ADD COLUMN responsible TEXT DEFAULT '';`
4. `ALTER TABLE tasks ADD COLUMN waiting_on_client INTEGER DEFAULT 0;`
5. Script de migração (executado no `seed` ou manual): para cada tarefa existente, `stage = column_name` (mapeado por tabela de equivalência), `progress = CASE WHEN column_name = 'Concluído' THEN 100 ELSE CASE WHEN column_name IN ('Em Execução', 'Em Progresso') THEN 50 ELSE 0 END END`, `responsible = assignee`, `waiting_on_client = 0`.
6. Atualizar `SCHEMA` (`src/server/storage.ts`) para incluir as novas colunas no `CREATE TABLE IF NOT EXISTS tasks` (adicionar antes de `comments`).

**Camadas a atualizar (todas):**
- `src/data/types.ts`: estender `Task` com `stage: string`, `progress: number`, `responsible: string`, `waitingOnClient: boolean`.
- `src/server/storage.ts`: `SCHEMA` + `listTasks` (mapear `stage`, `progress`, `responsible`, `waiting_on_client`) + `insertTask` (incluir novos campos no `INSERT`) + `updateTaskColumn` (atualizar `stage` e `waiting_on_client` quando `column` muda para "Aguardando você" ou "Concluído").
- `src/lib/portal-api.ts`: `createTaskFn` (aceitar `stage`, `progress`, `responsible`, `waitingOnClient`) e `moveTaskFn` (atualizar `waiting_on_client` conforme destino).
- `src/lib/api-hooks.ts` / `portal-api.ts`: garantir que o payload de resposta inclui os novos campos.
- `tests`: ver seção 5 abaixo.

**Risco e alternativa:**
- **Risco:** se `column_name` for removida no futuro, pode quebrar filtros existentes que dependem dela. **Mitigação:** manter `column_name` por pelo menos 2 releases, usando `stage` como fonte de verdade visual e `column_name` como legado (ou vice-versa, mas com contrato claro).
- **Alternativa (rejeitada):** reutilizar `column_name` como stage, adicionando apenas `progress` e `waiting_on_client`. **Motivo:** as 7 colunas atuais são excessivas para o cliente; a nova proposta simplifica para 5 etapas canônicas, melhorando a clareza.

---

### 2. UI — Board por Etapas (Kanban visual)

**Objetivo:** reorganizar o Kanban para as 5 etapas do cliente, com destaque visual para progresso, responsável, prazo e dependência do cliente.

**RECOMENDO: manter as 3 visões (Board / Lista / Tabela) e adaptar cada uma.**

**Etapas canônicas (mapa de cores atualizado):**
1. `not_started` → "Não iniciada" (badge cinza/slate)
2. `in_progress` → "Em andamento" (badge azul)
3. `waiting_client` → "Aguardando você" (badge âmbar/laranja, com destaque visual forte)
4. `review` → "Em revisão" (badge roxo)
5. `done` → "Concluída" (badge esmeralda)

**Componentes do card (modificação em `ClickUpTaskCard`, `tarefas.tsx`):**

- **Barra de progresso numérica:** abaixo do título, uma barra fina (`<div>` com `width: ${t.progress}%`) e texto `"{t.progress}%"`. Cores: cinza se `progress < 30`, azul se `30–70`, verde se `> 70`. Se `stage === 'done'`, forçar `progress = 100` no render.
- **Responsável:** manter o avatar `Initials` atual (`t.responsible || t.assignee`). Se `responsible` estiver vazio, usar `assignee`. Adicionar tooltip com nome completo.
- **Prazo (`due`):** manter badge existente, mas adicionar estado "vencido" (`isOverdue`) com cor vermelha e texto "Vencido"; se `due` é hoje, adicionar badge "Hoje" (âmbar); se `due` é no futuro, texto neutro.
- **Prioridade:** manter `Flag` com `priorityConfig`, mas adicionar badge visual com borda colorida à esquerda (`border-l-[4px]` já existe — manter e reforçar para prioridades altas).
- **Selo "Aguardando você":** quando `t.waitingOnClient === true` (ou `t.stage === 'waiting_client'`), adicionar:
  - Uma faixa de borda animada (`border-amber-400` com `animate-pulse`) no card.
  - Um badge fixo no topo: `"⚡ Aguardando você"` com fundo âmbar claro (`bg-amber-500/15`) e texto âmbar-escuro.
  - No board, a coluna "Aguardando você" recebe destaque de fundo (`bg-amber-500/5`) para diferenciar visualmente das demais.
- **Tags (`tags`):** manter como módulos; sem alteração.

**Visão Lista (`view === 'list'`):**
- Adicionar coluna "Progresso" (texto `"{progress}%"` ou barra visual simplificada).
- Adicionar coluna "Responsável" (inicial + nome).
- Adicionar coluna "Status" com badge de stage (substituir `column` pelo stage canônico, mas manter `column` como texto auxiliar por compatibilidade).
- Destacar linhas com `waiting_client` (`bg-amber-50` ou equivalente no tema).

**Visão Tabela (`view === 'table'`):**
- Adicionar colunas: `Progresso`, `Responsável`, `Etapa` (substituir `Status` pelo stage canônico).
- Adicionar filtro por `waiting_client` na toolbar.
- Manter filtro por prioridade e assignee.

**Contagem agregada (fora do board):**
- Adicionar um widget/card no topo da página (`tarefas.tsx`) que exibe: `"Aguardando você: {filtered.filter(t => t.waitingOnClient).length}"` com link âncora para a coluna correspondente. Isso transmite transparência ao cliente sem precisar navegar no board.

---

### 3. Fluxos (Criar / Editar / Mover)

**Criar (`Dialog` de criação):**
- Adicionar campos:
  - `Progresso` (slider ou input numérico 0–100, default `0` para `not_started`, `50` para `in_progress`, `100` para `done`).
  - `Responsável` (input texto, default `user?.name || ''`).
  - `Etapa` (select com as 5 etapas, default `not_started` ou primeira coluna). Se selecionado `waiting_client`, forçar `responsible` obrigatório (`z.string().min(1)`).
- Se `stage === 'waiting_client'`, validar no server (`createTaskFn`) que `responsible` não está vazio.

**Mover (`moveTaskFn` / drag-and-drop):**
- Regras de transição sugeridas (não obrigatórias, mas documentadas para UX):
  - `not_started` → qualquer (livre).
  - `in_progress` → `waiting_client` (requer `responsible` preenchido; se vazio, rejeitar com toast `"Defina o responsável antes de marcar como 'Aguardando você'."`).
  - `waiting_client` → `review` (livre, mas logar no audit).
  - `review` → `done` (exige `task.approve`; manter regra existente de `movePermission`).
  - Qualquer → `not_started` (livre, mas logar).
- Persistência: `moveTaskFn` já atualiza `column`. Estender para atualizar `stage` (mapear `column` para `stage`), `progress` (se `stage` é `done`, setar `100`; se `not_started`, `0`; se `in_progress`, manter; se `waiting_client`, manter ou resetar conforme regra), e `waiting_on_client` (`1` se `stage === 'waiting_client'`, senão `0`).

**Editar (`Dialog` de detalhe):**
- No sidebar de atributos (`tarefas.tsx`, ~linha 946), adicionar campos editáveis:
  - `Progress` (slider 0–100).
  - `Responsável` (input editável).
  - `Etapa` (select das 5 etapas, com botões rápidos para mover — já existem).
- Se `stage` for alterado para `waiting_client`, validar `responsible` não vazio.

---

### 4. RBAC / UX por Role

**Estado atual (`rbac.ts`):**
- Roles: `admin | diretor | gestor | desenvolvedor | auditor`.
- Permissões de tarefa: `task.create`, `task.move`, `task.approve`, `task.comment`.
- `movePermission('Concluído')` retorna `task.approve`; demais colunas retornam `task.move`.

**RECOMENDO: manter o modelo existente, mas adicionar restrições contextuais (sem criar novas permissões de base, apenas lógica no handler).**

| Role | Ver (Board/Lista/Tabela) | Criar tarefa | Mover (geral) | Mover para "Concluído" (approve) | Mover para "Aguardando você" | Comentar |
|---|---|---|---|---|---|---|
| `admin` | Sim | `task.create` | `task.move` | `task.approve` | Sim (com `responsible` obrigatório) | `task.comment` |
| `diretor` | Sim | `task.create` | `task.move` | `task.approve` | Sim (com `responsible` obrigatório) | `task.comment` |
| `gestor` | Sim | `task.create` | `task.move` | `task.approve` | Sim (com `responsible` obrigatório) | `task.comment` |
| `desenvolvedor` | Sim | Não (ou só se concedida `task.create`) | `task.move` | Não (`task.approve` exigida) | Sim (se `responsible` obrigatório) | `task.comment` |
| `auditor` | Sim (visualização completa, sem editar stage/progresso) | Não | Não | Não | Não | `task.comment` (se aplicável) |

**Observação:** não há role "cliente" no sistema atual. Se o portal for exposto a clientes externos, a recomendação é criar uma nova role (`cliente`) com permissão `task.read` (nova, se necessária) e `task.comment` limitada, sem `task.create`/`move`. **Para este plano, assumimos que o cliente visualiza via conta existente (ex.: auditor ou gestor) ou via link público futuro; portanto, não criamos `cliente` agora, mas deixamos a porta aberta no código.**

**Restrição específica para "Aguardando você":**
- Adicionar no `moveTaskFn` (`portal-api.ts`): se `data.column` mapeia para `waiting_client` (`'Aguardando você'`), verificar se `responsible` (ou `assignee`) está preenchido. Se vazio, retornar `{ ok: false, error: 'Defina o responsável antes de marcar como Aguardando você.' }`. Isso garante que a dependência do cliente tenha um responsável visível.

---

### 5. Testes (casos novos)

**Localizações:** `src/server/__tests__` (se existir; caso contrário, criar `tests/server/`) e `src/lib/__tests__`.

**Casos a adicionar:**

1. **Progress bounds:**
   - `progress` deve ser `0 ≤ progress ≤ 100`; rejeitar `101`, `-1`, `NaN`.
   - Testar que `updateTask` (ou `createTask`) com `progress > 100` retorna erro.

2. **Transições de stage:**
   - `not_started` → `in_progress` → `waiting_client` → `review` → `done` (fluxo válido).
   - `done` → `in_progress` (permitido, mas logar como reversão).
   - `waiting_client` sem `responsible` (rejeitar se `responsible === ''`).

3. **Responsável obrigatório:**
   - Quando `stage === 'waiting_client'`, `responsible` não pode ser vazio; validar no `createTaskFn` e `updateTaskFn`.

4. **Derivação de `waiting_on_client`:**
   - Se `stage` é `waiting_client`, `waiting_on_client` deve ser `1`; caso contrário, `0`. Testar consistência no `listTasks` e `getTask`.

5. **Compatibilidade com `column_name`:**
   - Tarefas criadas antes da migração (`column_name` existente, `stage` vazio) devem ser mapeadas corretamente pelo `listTasks`. Testar que `stage` é derivado de `column_name` quando `stage IS NULL`.

**Nota:** como o usuário pediu apenas planejamento, não é necessário escrever os testes agora, mas o plano deve listar exatamente esses casos para guiar a implementação futura.

---

## Parte B — Correção do Erro de Conexão n8n no Iframe

### 1. Diagnóstico Confirmado (não precisa re-descobrir)

- URL do iframe (`/automacoes`): `n8nUrl` = `https://163-176-45-217.sslip.io` (vindo de `N8N_PUBLIC_URL`).
- Origem do portal (`portal`): `https://portal.163.176.45.217.sslip.io` (diferente subdomínio).
- Container `n8n-recipe` (`n8n-custom-geos:latest`, imagem custom) expõe porta `5679→5678` e `3456` (register-server).
- `curl` confirma que o n8n responde `X-Frame-Options: SAMEORIGIN`.
- Resultado no browser: `net::ERR_BLOCKED_BY_RESPONSE` → "NetworkError when attempting to fetch resource."
- Há também `http://127.0.0.1:5679` inalcançável no browser do cliente (usado como `N8N_URL` internamente).

---

### 2. Opções de Correção (com trade-offs)

**Opção A — Relaxar/remover o header no proxy/nginx (camada de rede):**
- **Como:** configurar o proxy reverso que serve `163-176-45-217.sslip.io` para adicionar `proxy_hide_header X-Frame-Options;` ou `proxy_set_header X-Frame-Options "";`. Se o header vem diretamente do container n8n (não do proxy), seria necessário configurar o nginx/traefik que está na frente para sobrescrever.
- **Trade-off:** resolve o bloqueio sem alterar o portal, mas mantém o problema de URLs internas (`127.0.0.1`) se o n8n ainda referencia `N8N_PUBLIC_URL` de forma inconsistente. Além disso, `ALLOW-FROM` está obsoleto em alguns browsers.
- **Risco:** se o header for removido globalmente sem CSP `frame-ancestors`, o n8n fica vulnerável a clickjacking.

**Opção B — Proxy reverso do PRÓPRIO portal (`/n8n/*` → n8n, same-origin):**
- **Como:** configurar o servidor Nitro (ou o proxy de borda, ex.: nginx/traefik) para rotear `https://portal.163.176.45.217.sslip.io/n8n/*` para o container `n8n-recipe` (`127.0.0.1:5679` ou diretamente ao container). Isso elimina o bloqueio cross-origin (o iframe carrega `https://portal.163.176.45.217.sslip.io/n8n`, mesma origem). Resolve também o problema de URLs internas: o browser nunca vê `127.0.0.1`.
- **Trade-off:** requer configuração de proxy no ambiente de deploy (Nitro/Vercel/local). Em ambiente Nitro, pode ser feito via `vite.config.ts` proxy (`/n8n` → `http://127.0.0.1:5679`) para desenvolvimento, e via nginx/traefik para produção.
- **Segurança:** o iframe continua restrito à origem do portal; o proxy pode adicionar `X-Frame-Options: DENY` no nível do portal para o próprio portal, mas permitir `frame-ancestors 'self'` no proxy para `/n8n`.

**Opção C — Abrir n8n em aba nova (sem iframe):**
- **Como:** substituir `<iframe>` em `/automacoes` por um link `/n8n/*` que abre `target="_blank"` (já existe o botão "Abrir n8n").
- **Trade-off:** elimina o problema técnico imediatamente, mas quebra a experiência de "portal integrado" desejada pelo cliente e não resolve o login unificado.
- **RECOMENDO usar C apenas como fallback** se A+B falharem.

---

### 3. RECOMENDO: Opção B (proxy same-origin) + complemento de CSP

**Justificativa técnica:** a causa raiz é a diferença de origem + `X-Frame-Options: SAMEORIGIN`. A solução mais robusta é eliminar a diferença de origem (same-origin proxy) e, simultaneamente, configurar o n8n (ou o proxy) para aceitar `frame-ancestors 'self' https://portal.163.176.45.217.sslip.io` (via CSP) e remover/substituir `X-Frame-Options`. Isso resolve tanto o `NetworkError` quanto as URLs internas (`127.0.0.1` nunca aparece no browser).

**Passos técnicos específicos:**

1. **Configurar proxy no ambiente:**
   - **Local/dev (`vite.config.ts` ou `.env`):** adicionar `proxy: { '/n8n': { target: 'http://127.0.0.1:5679', changeOrigin: true, secure: false } }`.
   - **Produção (nginx/traefik):** adicionar `location /n8n/ { proxy_pass http://n8n-recipe:5678/; proxy_set_header Host $host; proxy_hide_header X-Frame-Options; proxy_set_header Content-Security-Policy "frame-ancestors 'self' https://portal.163.176.45.217.sslip.io;"; }`.

2. **Ajustar `n8nUrl` no portal (`src/routes/automacoes.tsx`):**
   - Em vez de `n8nUrl = n8nInfo?.publicUrl ?? ...`, usar `n8nUrl = '/n8n'` (ou `https://portal.163.176.45.217.sslip.io/n8n`) quando o proxy está ativo.
   - Manter `n8nInfo?.publicUrl` como fallback para ambiente sem proxy (dev remoto).

3. **Resolver URLs internas (`127.0.0.1`):**
   - Com o proxy, o browser nunca acessa `127.0.0.1`. O container `n8n-recipe` continua acessível internamente (`N8N_URL=http://127.0.0.1:5679`) para a API do portal (`n8nFetch`), mas o iframe usa a origem pública.
   - Verificar se o `register-server.js` (porta 3456) também precisa ser exposto via proxy (`/n8n-register` ou manter interno, já que `provisionN8nUser` usa URL interna). Se o proxy é apenas para o iframe, o registro pode continuar interno.

4. **Ajuste do header no container (se necessário):**
   - Se o proxy não conseguir sobrescrever `X-Frame-Options` (porque o container envia com `DENY` e o proxy respeita), configurar o container `n8n-custom` (imagem `n8n-custom-geos:latest`) para não enviar `X-Frame-Options`. Isso pode ser feito no `entrypoint-geos.sh` ou no `Dockerfile` (adicionar `ENV N8N_PROTOCOL=https` e `ENV WEBHOOK_TUNNEL_URL=...`), mas a abordagem mais simples é deixar o proxy fazer o trabalho.
   - **Validação:** após mudança, rodar `curl -I -H "Referer: https://portal.163.176.45.217.sslip.io" https://portal.163.176.45.217.sslip.io/n8n` e verificar que o header `X-Frame-Options` está ausente ou contém `ALLOW-FROM` (ou melhor, substituído por CSP `frame-ancestors`).

---

### 4. Validação (passos de teste manual/e2e)

1. **Curl (proxy ativo):**
   ```bash
   curl -I -L https://portal.163.176.45.217.sslip.io/n8n
   # Esperado: 200 OK; X-Frame-Options ausente ou substituído; CSP com frame-ancestors.
   ```

2. **Headless browser (Puppeteer/Playwright ou manual):**
   - Acessar `https://portal.163.176.45.217.sslip.io/automacoes` logado.
   - Verificar que `<iframe src=".../n8n">` carrega sem `ERR_BLOCKED_BY_RESPONSE` no console.
   - Confirmar que não aparece `127.0.0.1:5679` em nenhuma requisição de rede no DevTools.

3. **Regressão:**
   - Confirmar que `getN8nInfoFn` e `listN8nWorkflowsFn` continuam funcionando (usam `N8N_URL` interno).
   - Confirmar que o botão "Abrir n8n" (`target="_blank"`) ainda funciona (usando `publicUrl` ou proxy).

---

## Parte C — Login Unificado Portal ⇄ n8n (Mesmo Login, Idealmente SSO)

### 1. Diagnóstico do Estado Atual (confirmado)

- `n8n-custom/patches/email.auth-handler.js` já consulta o Postgres do portal (`users` tabela, `argon2id` + `pepper`) e faz fallback para validação de e-mail/senha do portal. Se o usuário existe no portal e a senha é válida, ele é criado/encontrado no n8n e retorna como `global:member` (ou `global:admin` se `admin`). **Portanto, "mesma credencial" já funciona tecnicamente quando o usuário digita manualmente no n8n.**
- `src/server/n8n.ts`: `provisionN8nUser` faz POST em `http://127.0.0.1:3456/register` (register-server do container custom) com senha temporária `"Temp12345!"`, criando um usuário n8n com senha temporária. O toast exibe essa senha, criando risco de segurança e conflito com "mesmo login".
- `register-server.js` (`n8n-custom/patches/`) aceita `email`, `password`, `firstName`, `lastName` e cria no SQLite interno do n8n (`database.sqlite`).
- Não há mecanismo de cookie/session compartilhado entre o portal (`portal.163.176.45.217.sslip.io`) e o n8n (`163-176-45-217.sslip.io` ou `/n8n` via proxy).

---

### 2. Arquitetura Recomendada para SSO (Opção 1 — Token de Sessão + Proxy Same-Origin)

**RECOMENDO: implementar SSO via token de sessão no proxy same-origin (`/n8n/*`), com rollout faseado.**

**Racional:** como o `email.auth-handler.js` já valida no Postgres do portal, o usuário não precisa de uma credencial separada. O que falta é o estabelecimento automático da sessão no n8n sem redigitar a senha e sem expor senha temporária. A solução é:

**Fase 1 — Remover senha temporária (imediato, baixo risco):**
1. No `src/lib/portal-api.ts` (ou `src/server/n8n.ts`), modificar `provisionN8nUser` para não enviar senha temporária. Em vez disso:
   - Se o usuário já existe no n8n (`email.auth-handler.js` confirma), apenas retornar uma mensagem de sucesso sem criar novo usuário.
   - Se não existe, usar a senha atual do usuário do portal (`user.passwordHash` não está disponível diretamente, mas o portal pode solicitar ao usuário que confirme a senha uma vez, ou gerar um token de uso único).
2. Remover a linha que define `"Temp12345!"` em `provisionN8nUser`.
3. Atualizar `register-server.js` para aceitar um `token` opcional (JWT/código curto) além de `password`, e validar esse token contra uma chave compartilhada (env `N8N_SSO_SECRET`).

**Fase 2 — Token de sessão no proxy (médio prazo, médio risco):**
1. Criar endpoint no portal (`POST /api/n8n/sso-token`) que retorna um JWT assinado (`N8N_SSO_SECRET`) contendo `{ email, role, exp: +5min }`.
2. No proxy (`/n8n/*`), adicionar um middleware (ou configurar no n8n custom) que, ao receber `?sso=TOKEN`, valida o token, chama `email.auth-handler.js` (que já valida no Postgres) e estabelece a sessão do n8n (cookie `n8n-auth`).
3. No `tarefas.tsx` ou `automacoes.tsx`, após login no portal, redirecionar o iframe para `/n8n?token=...` (ou fazer uma requisição server-side para trocar o token por cookie antes de renderizar o iframe).

**Fase 3 — Automação completa (longo prazo, se necessário):**
- Se o proxy estiver configurado, o portal pode fazer uma requisição `POST /n8n/sso` (interno) com o token e receber o cookie de sessão. O iframe é carregado com o cookie já presente (`same-origin` permite cookies de primeira parte sem restrições de `SameSite`).

---

### 3. Detalhe Técnico — `email.auth-handler.js` e `register-server.js`

**Estado atual (`email.auth-handler.js`):**
- Quando o usuário faz login no n8n (`POST /rest/login`), o handler tenta validar no banco local do n8n (`userRepository`). Se falhar, consulta o `portalPool` (Postgres do portal), valida `argon2id`, e se válido, cria/atualiza o usuário no n8n com `bcrypt.hash(password, 10)`.
- Isso significa que a senha do portal e a senha do n8n podem ser diferentes (o n8n armazena uma cópia `bcrypt` da senha do portal). Se o usuário muda a senha no portal, a senha do n8n fica desatualizada até o próximo login (quando o handler atualiza).

**RECOMENDO para unificação:**
- Manter o `email.auth-handler.js` como está (já é unificado por credencial), mas garantir que a senha temporária não seja usada. Em vez de `provisionN8nUser` criar um usuário com senha temporária, o portal deve simplesmente instruir o usuário a fazer login no n8n com a mesma senha. Como o handler já valida no portal, o login funcionará imediatamente.
- Se o objetivo é evitar que o usuário digite a senha no iframe, a solução é o token SSO (Fase 2), não uma senha temporária.

**Modificações necessárias nos arquivos custom (`n8n-custom`):**
- `email.auth-handler.js`: sem alteração (já funciona).
- `register-server.js`: adicionar suporte opcional a `token` (JWT) em vez de apenas `password`. Se `token` for fornecido e válido, criar o usuário com uma senha aleatória interna (não exposta) e estabelecer a sessão.
- `entrypoint-geos.sh` / `Dockerfile`: garantir que `N8N_PUBLIC_URL` seja usado corretamente para URLs de redirecionamento e webhook, evitando `127.0.0.1`.

---

### 4. Garantias de Segurança

- **Sem senha temporária visível:** eliminar `"Temp12345!"` de qualquer código (`src/server/n8n.ts`, `portal-api.ts`, `register-server.js`).
- **CSRF:** o token SSO (`N8N_SSO_SECRET`) deve ter expiração curta (5 minutos) e ser de uso único (marcado como usado após consumo, se possível).
- **Cookie de sessão:** com proxy same-origin (`/n8n/*`), o cookie `n8n-auth` é de primeira parte (`SameSite=Lax` ou `Strict`), reduzindo risco de vazamento cross-site.
- **Proteção atual mantida:** `userCan`, `auth.requirePermission`, e o `loginFn` com rate limit (`requestKey`) permanecem intactos.

---

### 5. Rollout / Ordem de Execução e Esforço

| Ordem | Etapa | Parte | Esforço Estimado | Dependências | Risco |
|---|---|---|---|---|---|
| 1 | A. Modelo de dados + migração SQL | A | **S (1 dia)** | Nenhuma | Baixo (aditivo) |
| 2 | A. UI — card, board, lista, tabela | A | **M (2–3 dias)** | 1 | Médio (visual, sem quebrar UX) |
| 3 | A. Fluxos (criar/editar/mover) + RBAC | A | **S (1 dia)** | 1, 2 | Baixo |
| 4 | A. Testes (progress, stage, responsible) | A | **S (1 dia)** | 1–3 | Baixo |
| 5 | B. Configuração do proxy (`vite.config.ts` / nginx) + ajuste `n8nUrl` | B | **S (1–2 dias)** | Nenhuma (mas ideal após A) | Médio (infra) |
| 6 | B. Validação manual (curl, headless) | B | **S (0,5 dia)** | 5 | Baixo |
| 7 | C. Remover senha temporária (`provisionN8nUser`) | C | **S (0,5 dia)** | Nenhuma | Baixo |
| 8 | C. Endpoint SSO no `register-server.js` + token no portal | C | **M (2–3 dias)** | 7, 5 (proxy) | Médio (autenticação) |
| 9 | C. Integração iframe (`/automacoes`) com token/proxy | C | **S (1 dia)** | 8, 5 | Médio |

**Justificativa da ordem A → B → C:**
- A é independente e de maior valor percebido pelo cliente (visual). Executar primeiro permite demonstrar progresso e isolar problemas de UI sem interferir na infraestrutura n8n.
- B (proxy) deve ser feito antes de C (SSO), porque o SSO só funciona de forma limpa com `same-origin`. Se B falhar, C pode ser reduzido à Fase 1 (remover senha temporária + login manual), que ainda atende ao requisito básico.
- C (SSO) tem maior risco porque envolve autenticação. Separá-lo de B evita que uma falha no proxy seja confundida com uma falha no login.

---

## Riscos / Pontos de Atenção

1. **Dados existentes (`tasks`):** a migração aditiva (`ALTER TABLE`) é segura, mas o script de mapeamento (`stage` a partir de `column_name`) deve ser executado antes de qualquer deploy que use `stage`. Se `stage` for `NULL`, a UI deve tratar como `not_started` (default visual).
2. **Performance SQLite:** adicionar `INTEGER` (`progress`, `waiting_on_client`) e `TEXT` (`stage`, `responsible`) aumenta levemente o tamanho da linha, mas o impacto é negligenciável para o volume esperado (<10k tarefas).
3. **Proxy em produção:** se o deploy for em Vercel/Nitro, configurar proxy `vite.config.ts` não afeta produção (Vercel usa `vercel.json`). É necessário verificar se `vercel.json` ou a configuração do container n8n permite roteamento `/n8n`. Se não for possível, a solução de fallback é usar subdomínio (`n8n.portal...`) com CSP `frame-ancestors`, mas isso mantém o problema cross-origin parcialmente.
4. **Senha temporária:** a presença de `"Temp12345!"` no código (`provisionN8nUser`) é um risco de segurança imediato. A primeira ação de C deve ser a remoção dessa constante, mesmo antes do SSO completo.
5. **Testes existentes:** ao alterar `Task` em `src/data/types.ts`, verifique se componentes que usam `Task` (ex.: `tarefas.tsx`, `portal-api.ts`) são atualizados, senão o TypeScript falhará (`Property 'stage' does not exist`).
6. **RBAC:** se for introduzida uma role `cliente` no futuro, a matriz `matrix` (`rbac.ts`) precisa ser estendida. Deixe um comentário no código (`/* Futuro: cliente — task.read, task.comment limitado */`) para facilitar.

---

*Fim do documento de planejamento. Nenhum arquivo foi alterado. Nenhum teste foi executado. Nenhum código foi implementado.*
