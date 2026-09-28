# Relatório — Avatar na Equipe + Perfil Público — Portal GWG

## 1) Resumo das mudanças

### 1.1 Equipe (`src/routes/engenharia.tsx`)
- Card "Quem Somos" virou **link clicável** para o perfil público (`Link to="/perfil/$userId"` com `params={{ userId: u.id }}`).
- Se `u.avatarUrl` existe, renderiza `<img>` redondo (`size-14 rounded-full object-cover`); senão mantém `initials(u.name)`.
- Preservado link `mailto:` com `onClick={(e) => e.stopPropagation()}` para não interferir na navegação do card.

### 1.2 Perfil Público (`src/routes/perfil.$userId.tsx`)
- Rota dinâmica `createFileRoute("/perfil/$userId")` com `Route.useParams()`.
- Usa `usePublicUser(userId)` (hook em `api-hooks.ts`) que chama `getPublicUserFn`.
- Se não logado: exibe mensagem "Faça login para visualizar este perfil." (não joga `notFound`).
- Se usuário não existe: `throw notFound()`.
- Exibe foto grande (`size-24 rounded-full object-cover` ou `initials`), nome, role (`roleLabel`), cargo, depto, bio completa, e-mail (`mailto:`), funções concedidas (badges), botão "Voltar" (`Link to="/engenharia"`), breadcrumb e CTA "Editar meu perfil" (`Link to="/perfil"`) quando `me.id === userId`.

### 1.3 Server API (`src/lib/portal-api.ts`)
- Nova `getPublicUserFn` (`GET`) com validação zod (`userId`: string, min 1, max 128, `.strict()`).
- Requer usuário autenticado (`c.auth.getCurrentUser`); se não logado retorna `ok: false`, erro "Faça login para visualizar este perfil.".
- Se usuário não encontrado: `ok: false`, erro "Usuário não encontrado.".
- Retorna `PublicUser` montado via `publicUserWithFunctions` (inclui `avatarUrl` e `functions`).

### 1.4 Hooks (`src/lib/api-hooks.ts`)
- Adicionado `getPublicUserFn` no import e novo hook `usePublicUser(userId)` (`queryKey: ["public-user", userId]`, `enabled: !!userId`).

### 1.5 Testes (`src/server/__tests__/team-avatar.test.ts`)
- 13 testes cobrindo:
  - Propagação de `avatarUrl` em `publicUser` e `publicUserWithFunctions` (presente e ausente).
  - Replicação do zod validation (`getPublicUserFn`) — aceita válido, rejeita vazio, rejeita >128 chars, rejeita campo extra.
  - Comportamento com storage (`sqlite` e `memory`) propagando `avatarUrl`.
- Nenhum teste existente quebrado.

### 1.6 Route Tree
- `routeTree.gen.ts` foi regenerado automaticamente pelo build (`vite build`) incluindo `PerfilUserIdRoute` (`/perfil/$userId`).

### 1.7 Spec / AC (`spec/acceptance-criteria.md`)
- Adicionada **AC-016** cobrindo avatar na equipe, link para perfil público, exibição do perfil público e comportamento `notFound`.

## 2) Quality Gate (resultados reais via `bun run`)

| Etapa | Resultado | Observação |
|---|---|---|
| `bun run test` | **236 PASS** (223 existentes + 13 novos) | Todos verdes; `team-avatar.test.ts` 13 PASS |
| `bun run typecheck` | Erros pré-existentes (`rbac.ts`, `portal-api.ts`, `storage.ts`, `login-flow`, etc.) | Nenhum erro novo em arquivos alterados (`perfil.$userId`, `engenharia`, `api-hooks`, `portal-api`) |
| `bun run build` | PASS (`.output` gerado) | `routeTree.gen.ts` regenerado; `perfil.$userId` incluído no bundle (`perfil._userId-DxiU8frs.js`) |
| `bun run lint` | Erros pré-existentes (`portal-api.ts` linha 221 `no-empty`, `api-hooks.ts` linha 130 `any`) | Arquivos alterados (`perfil.$userId`, `engenharia`, `portal-api`, `team-avatar`) sem novos erros |

## 3) Verificação manual (cheque rápido)

- `/engenharia` carrega cards com foto (`avatarUrl`) ou iniciais, todos clicáveis para `/perfil/$userId`.
- `/perfil/$userId` carrega foto grande, dados completos, badges de funções e link "Voltar".
- `/perfil/$userId` do próprio usuário mostra "Editar meu perfil".
- Perfil inexistente retorna `notFound()` (erro 404).
- Não alterado `.env`, `.data/`, `.output/`, `node_modules/`; não usado `/tmp`; não rodado formatador no repo inteiro; não feito `git commit`; identidade GWG preservada ("GWG — Grupo W. Geotec" mantido em `PageHeader` e `head` meta).
