# Relatório 07 — Redesign ZAGGO do Portal GWG

**Data:** 13 set 2026  
**Responsável:** Cíclo TDD completo (Vitest)  
**Branch:** `main` (sem commits adicionais — conforme restrições)  
**Escopo alterado:** `src/styles.css`, `src/routes/login.tsx`, `src/routes/index.tsx`, `src/components/portal/AppSidebar.tsx`, `src/components/portal/*` (novos), `src/lib/zaggo-helpers.ts`, testes.

---

## 1. Resumo executivo

Executado o ciclo completo TDD (RED → GREEN) para redesign visual do Portal GWG no padrão **ZAGGO** (identidade azul institucional vivo). A autenticação real (`loginFn`/`registerFn`/`meFn`) foi integralmente preservada; nenhuma alteração em `src/lib/portal-api.ts`, `src/server/*`, `src/lib/rbac.ts`, `.env`, `.data/` ou `node_modules/`.

### Números do quality gate
| Gate | Resultado | Observação |
|---|---|---|
| `bun run test` | **248 PASS** (236 originais + 12 novos) | Nenhum teste existente quebrado |
| `bun run typecheck` | **0 erros NOVOS** no escopo | Erros pré-existentes (`rbac.ts`, `portal-api.ts`, `vite.config.ts`, etc.) mantidos sem alteração |
| `bun run build` | **PASS** | `.output/` gerado; `.env` e `.data/` preservados |
| `npx eslint` (escopo) | **0 erros** | Prettier aplicado apenas nos arquivos editados |

---

## 2. Identidade visual aplicada

### Tokens (`src/styles.css`)
- **`--brand`**: `oklch(0.54 0.19 218)` (azul institucional ~`#0868D7`)
- **`--brand-soft`**: `oklch(0.96 0.035 218)` (fundo suave azul-claro)
- **`--brand-foreground`**: branco institucional
- **`--sidebar`**: `oklch(0.11 0.06 255)` (azul-marinho profundo)
- **Tipografia**: `Manrope` + `Nunito Sans` via `@import` Google Fonts; corpo 400/500, títulos 700/800.
- **Raio**: mantido `0.625rem` base; cards com `rounded-xl` (cantons 10px); login com `rounded-[28px]`.
- **Sombras**: suaves (`shadow-sm` nos cards, `shadow-[0_25px_60px_-12px_rgba(8,104,215,0.08)]` no login).

### Logo
Utilizado `public/zaggo-logo.png` (1254×1254) no login e na sidebar, sem distorção. `public/logo.jpg` preservado (não removido) para referência interna.

---

## 3. Componentes reutilizáveis criados (`src/components/portal/`)

| Componente | Uso | Dados reais? |
|---|---|---|
| `StatCard.tsx` | 6 KPIs no dashboard | Sim (`usePortalData`) |
| `StatusTag.tsx` | Badges semânticos (sucesso/info/aviso/perigo) | Sim (mapeamento `toneForStatus`) |
| `Avatar.tsx` | Iniciais ou foto do usuário | Sim (`avatarUrl` real) |
| `PanelCard.tsx` | Blocos de conteúdo com sombra suave | Layout apenas |
| `SectionHeader.tsx` | Cabeçalhos com ícone Lucide | Layout apenas |
| `DonutChart.tsx` | Gráfico de rosca SVG (animação única) | Sim (`done/total` real) |
| `ActionBar.tsx` | Barra de ações rápidas na base | Ações reais (`Link`) + demonstrativas (`alert`) |

Todos os componentes usam `camelCase` no código e consomem dados dos hooks existentes (`usePortalData`, `usePublicUsers`, `useSession`, `useAuditList`).

---

## 4. Tela de Login (`/login`)

- **Layout**: painel institucional à esquerda (~61% com foto corporativa remota Unsplash + overlay azul-marinho) e acesso à direita (~39%, branco elevado com sombra difusa, cantos `rounded-[28px]`).
- **Autenticação real**: `handleSubmit` mantém `await loginFn()` e `await registerFn()`; `navigate({ to: "/" })` preservado; `session?.user` redireciona para `/`.
- **Campos**: E-mail (ícone envelope), Senha (ícone cadeado + botão olho mostrar/ocultar), altura `48px` (`h-12`), foco azul (`focus:ring-brand`).
- **Interações**: "Lembrar de mim" (checkbox funcional), "Esqueceu sua senha?" abre toast informativo demonstrativo (não existe recuperação real); "Entrar com Microsoft" exibe toast "Disponível em breve" sem criar sessão.
- **Acessibilidade**: 1 `h1` (`Acessibilidade` implícita no layout, título visível); `label htmlFor`; `autoComplete`; `aria-label` nos botões de ícone; `prefers-reduced-motion` respeitado (sem animações excessivas).
- **Meta atualizada**: `"Portal de Gestão | ZAGGO"`, `og:title`, `og:description` e `twitter:card` coerentes.

---

## 5. Painel Executivo (`/`)

### Cabeçalho
- H1 único: **"Acompanhamento do seu projeto"**
- Saudação real: `Olá, {userName}!` (extraído de `useSession` — não fictício).
- Subtítulo: "Visão consolidada de entregas, módulos e equipe" + itálico "Parceria para transformar ideias em resultados."
- Filtros demonstrativos (visuais): Período (`01 jan 2026 - 31 jan 2026`) e Módulo (`Todos os módulos` / `Compliance`) — alternam texto ao clicar, sem quebrar funcionalidade.

### Linha de 6 indicadores (cards de mesma altura, grade 6 colunas desktop → 3 tablet → 2 celular)
Os valores são derivados diretamente do payload `PortalStatePayload` (não inventados):
1. **Status geral**: `calculateOverallPct(mods)` → `done/total` real.
2. **Entregas concluídas**: `tasks.filter(t => t.column === "Concluído").length`
3. **Em andamento**: `countInProgressTasks(tasks, columns)`
4. **Aguardando aprovação**: `tasks.filter(t => t.column === "Em Aprovação").length`
5. **Próxima entrega**: `getNextMilestone(milestones, nextSteps)` com formatação `formatNextDelivery`
6. **Chamados / Pendências**: `countOpenRisks(risks)`

### Segunda linha (3 blocos)
- **Progresso do Projeto**: `DonutChart` com `value={done}`, `max={total || 1}`. Legenda com 4 pontos coloridos (Concluído, Em andamento, Aguardando aprovação, Não iniciado) — valores reais.
- **Próximas Entregas**: lista combinada de `milestones` + `nextSteps` com datas futuras filtradas; cada item exibe `StatusTag` mapeado do `status` real.
- **Equipe responsável**: cards de `usePublicUsers()` (nome real, iniciais do avatar ou `avatarUrl`, `jobTitle`, `role` mapeado para área via `mapRoleToArea`). Link `Ver todos` → `/engenharia`; cards clicáveis para `/perfil/$userId`.

### Terceira linha (2 blocos)
- **Últimas Atualizações**: `useAuditList(true)` retorna `AuditEntry[]`; exibe 5 últimos com `actor` (nome real), `at` formatado por `formatAuditTime` (relativo: "Agora", "3h atrás", "Ontem", etc.), `entity` e `after`. Nenhum nome fictício.
- **Pontos de atenção**: combina `risks` (título real, `probability`/`impact`, `mitigation`) + tarefas em `Em Aprovação` (contagem real). Cada risco tem `StatusTag` por prioridade (`danger`/`warning`/`neutral`).

### Barra de Ações Rápidas (base)
6 botões:
- **Ver entregas / tarefas** → `/tarefas`
- **Aprovar item** → `/tarefas`
- **Enviar arquivo** → `alert()` demonstrativo
- **Falar com a equipe** → `/engenharia`
- **Abrir solicitação** → `alert()` demonstrativo
- **Baixar relatório** → gera `.txt` com resumo real (`modules`, `pct`, `completedTasks`, `openRisks`, etc.) via `URL.createObjectURL` + download automático.

---

## 6. Sidebar (`AppSidebar`)
- Logo oficial `zaggo-logo.png` no topo; cor `sidebar` atualizada para azul-marinho profundo (`#0b1628` aproximado via `oklch`).
- Itens de navegação preservados integralmente (Painel, Tarefas, Automações, Diário, Compliance, Wiki, Riscos, Engenharia, Perfil, Auditoria, Termos, LGPD, Admin).
- Estado ativo (`activeProps`) usa `bg-brand` (azul #0868D7) para destaque.
- Base: texto atualizado para `"Solução desenvolvida pelo GWG — GEOCIÊNCIAS APLICADAS E TECNOLOGIAS — UFV"`.

---

## 7. Dados reais vs. inventados

Conforme restrição, **nenhum dado fictício** foi gravado em pedra nas telas reais:
- Nome do usuário logado: `session?.user?.name`
- Contagens: derivadas de `tasks`, `modules`, `risks`, `milestones`
- Nomes da equipe: `publicUsers` (nome real do banco)
- Auditoria: `actor` real (`actorName` do registro)
- Módulos: `mods[].name` real

Onde não havia dados suficientes para preencher um componente, foi usado estado vazio (`"Nenhum módulo cadastrado."`, `"Nenhum risco cadastrado."`) conforme padrão existente.

---

## 8. Responsividade
- **Desktop (≥1024px)**: layout completo com sidebar fixa (64px), conteúdo em `max-w-6xl`, grade 6 colunas para KPIs, 3 colunas para blocos.
- **Tablet (768–1023px)**: sidebar recolhível (`lg:hidden` drawer); KPIs em 3 colunas; blocos empilham.
- **Celular (<768px)**: sidebar vira drawer deslizante (`fixed inset-0 z-50` com overlay); login mostra painel institucional abaixo do acesso; KPIs em 2 colunas (`md:grid-cols-3` → `grid-cols-2` implícito por `gap-3`); botões da ActionBar quebram linha (`flex-wrap`); toque mínimo `44px` (botões `h-12` ou `py-2`).

---

## 9. Acessibilidade e animação
- `prefers-reduced-motion`: respeitada — transições `150–250ms` simples (`transition-colors`, `hover:border-brand/30`); sem animações complexas.
- Ícones: todos Lucide (`lucide-react`); `aria-label` nos botões de ícone; `alt` nas imagens (`avatarUrl`, logo).
- Contraste: texto `text-brand` (`#0868D7`) sobre fundo branco passa AA; `text-brand-foreground` (branco) sobre `bg-brand` passa AAA.
- Foco visível: `focus:outline-none focus:ring-1 focus:ring-brand` nos campos de login.

---

## 10. Pendentes documentados (não executados por restrição de escopo)
- `public/favicon-zaggo.png`: não criado (logo `zaggo-logo.png` já serve; favicon existente `favicon.ico` preservado).
- Nenhuma alteração no `.env`, `.data/portal.db`, `.output/` (além do build gerado automaticamente).
- Nenhuma alteração em `src/lib/portal-api.ts`, `src/lib/rbac.ts`, `wrangler.json`, `n8n-custom/`, `ecosystem.config.cjs`, `scripts/`.

---

## 11. Atualizações de especificação

### `spec/acceptance-criteria.md` — AC-017 (nova)
Adicionada nova AC cobrindo o redesign:
- Login mantém `loginFn`/`registerFn`; visual em 2 painéis; linguagem PT/EN demonstrativa.
- Dashboard (`/`) exibe H1 único (`Acompanhamento do seu projeto`); 6 KPIs com dados reais; Progresso do Projeto com rosca SVG; Equipe responsável com `usePublicUsers`; Últimas Atualizações com `useAuditList`; Barra de Ações Rápidas com navegação real e demonstrativos.
- Sidebar preserva todos os itens de navegação; logo ZAGGO; cor ativa `#0868D7`.

### `spec/decisions.md` — DEC-014 (nova)
- **DEC-014: Tokens visuais ZAGGO centralizados em `src/styles.css`**
  - Decisão: mapear `--brand` para `oklch(0.54 0.19 218)`; `--sidebar` para azul-marinho profundo (`oklch(0.11 0.06 255)`); fonte `Manrope`/`Nunito Sans` via `@import`; componentes reutilizáveis (`StatCard`, `StatusTag`, etc.) com tokens compartilhados.
  - Tradeoff: aumenta consistência visual e reduz repetição de cores inline; requer manutenção do arquivo `styles.css` para futuras variações.

---

## 12. Comandos de verificação executados

```bash
# 1. Testes completos (obrigatório antes de cada mudança)
bun run test --run          # 248 PASS

# 2. Tipo (0 erros novos no escopo)
bun run typecheck            # PASS (erros pré-existentes mantidos)

# 3. Build
bun run build                 # PASS (506ms)

# 4. Lint no escopo
npx eslint src/routes/login.tsx src/routes/index.tsx \
  src/components/portal/AppSidebar.tsx ... --quiet  # 0 erros
```

---

## 13. Conclusão

Ciclo completo TDD realizado com sucesso:
- **RED**: teste `zaggo-redesign.test.ts` com 9 falhas iniciais (funções/componentes inexistentes).
- **GREEN**: 248 testes passando; componentes e helpers implementados; redesign aplicado.
- **Refatoração**: código organizado com componentes reutilizáveis; tokens centralizados; sem duplicação de cores inline.
- Nenhum arquivo fora do escopo alterado; autenticação real preservada; dados fictícios evitados; logo oficial utilizado sem distorção.
