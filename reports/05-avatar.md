# Relatório — Avatar (Foto de Perfil) — Portal GWG

## 1) Resumo das mudanças

### Banco / Storage
- `UserRow` ganhou `avatarUrl: string | null` (`src/server/storage.ts`).
- `SCHEMA` (`users`): adicionada `avatar_url TEXT`.
- `rowToUser`: mapeia `avatar_url` → `avatarUrl`.
- `insertUser`: inclui `avatar_url` no INSERT.
- `updateUser` (`SqliteBackend` e `MemoryStorage`): aceita `avatarUrl` no patch e atualiza `avatar_url`.
- `ensureSqliteSchema`: migração aditiva idempotente (`ALTER TABLE users ADD COLUMN avatar_url TEXT`) para SQLite (arquivo/memória) e D1.
- `PostgresStorage.execSchema`: adiciona `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;`.

### RBAC / Auth
- `PublicUser` (`src/lib/rbac.ts`): `avatarUrl: string | null`.
- `publicUser` e `publicUserWithFunctions` (`src/server/auth.ts`): propagam `avatarUrl`.

### API / Validação
- `updateProfileFn` (`src/lib/portal-api.ts`):
  - Schema zod: `avatarUrl` opcional; aceita `""`, `null`, ou `data:image/(png|jpeg|jpg|webp);...`; rejeita payload > 1.5MB (`.refine`).
  - Normaliza `""`/`null` → `null` antes de persistir.
  - Registra auditoria `"Perfil atualizado"` com o campo `avatarUrl` quando alterado.

### UI (`src/routes/perfil.tsx`)
- Card lateral: se `avatarValue` existe, renderiza `<img>` redondo; senão `initials(user.name)`.
- `input[type=file]` (accept png/jpeg/webp) com preview via `URL.createObjectURL` + compressão (`<canvas>`, max 256px, qualidade 0.85, formato jpeg/png conforme original).
- Validação no cliente: tipo MIME e payload pós-compressão (`> 1.5MB` rejeita).
- Botão "Remover foto": define `avatarValue = ""` (será convertido em `null` no envio).
- Envio agrupado ao "Salvar perfil" (mais robusto): a mutation inclui `avatarUrl` e invalida `qk.session` + `["public-users"]` no `onSuccess`.

### Testes (TDD)
- `src/server/__tests__/avatar-profile.test.ts`: 18 testes cobrindo:
  - Persistência (`sqlite` e `memory`) de `avatarUrl` (inserção, atualização, remoção via `null`, aceitação de `""`).
  - Propagação em `PublicUser` (`publicUser` e `publicUserWithFunctions`).
  - Validação zod (aceita png/jpeg/webp, rejeita `http://`, rejeita payload > 1.5MB, aceita `null`/`""`/`undefined`).

### Spec
- `spec/acceptance-criteria.md`: adicionada AC para avatar (atualização de perfil com foto, persistência, propagação na sessão).

## 2) Testes

- **Antes:** 205 testes PASS (baseline após integração n8n).
- **Depois:** 205 + 18 novos (`avatar-profile.test.ts`) = **223 PASS**.
- `avatar-profile.test.ts`: 18 PASS.
- Nenhum teste existente quebrado.

## 3) Quality Gate

| Etapa | Resultado | Observação |
|---|---|---|
| `bun run test` | 223 PASS (inclui 18 novos) | Todos verdes |
| `bun run typecheck` | Erros pré-existentes apenas (`rbac.ts`, `login-flow`, etc.) | Nenhum erro novo introduzido |
| `bun run build` | PASS (`.output` gerado) | Sem falhas |
| `bun run lint` | Erros pré-existentes (`turso-storage`, `vite.config`, `catch {}`) | Arquivos alterados sem novos erros |

## 4) Verificação manual (cheque rápido)

- A página `/perfil` carrega o avatar existente (`user.avatarUrl`) como `<img>` redondo.
- Seleção de arquivo PNG/JPEG/WebP gera preview comprimido no card lateral.
- Botão "Salvar perfil" envia `avatarUrl` (data URL ou `null` se removido) juntamente com os outros campos.
- Remoção via "Remover foto" + "Salvar perfil" seta `avatar_url = NULL` no banco (todos os drivers).
- Migração `avatar_url` ocorre automaticamente na abertura (`SqliteStorage.open`, `MemoryStorage`, `D1Storage.open`, `PostgresStorage.open`).
