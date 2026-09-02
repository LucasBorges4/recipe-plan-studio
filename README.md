# Recipe Blueprint

Faça o planejamento de uma aplicação web que contenha todas as caracteristicas apresentadas nas imagens, faça um detalhamento seguindo o formato de uma receita descrevendo cada uma das funcionalidades seguindo um paradigma de modelo assim como: Role + Task + Context + Constraints .

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://recipe-plan-studio.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8280048a-6b8b-4c47-982f-0069599a09e4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Deploy na Vercel (Fork LucasBorges4)

> Repositório forkado de `TecnoCAF-ufv/recipe-plan-studio` para deploy na Vercel: **https://github.com/LucasBorges4/recipe-plan-studio**

### 1-click Deploy

1. Acesse https://vercel.com/new
2. Importe `LucasBorges4/recipe-plan-studio`
3. Framework: **Vite** | Build: `npm run build` | Output: `.output/public`
4. Env var obrigatória: `NITRO_PRESET=vercel` (já em `vercel.json`)
5. Opcional: `AUTH_PEPPER` (`openssl rand -base64 32`), `REGISTRATION_CODE` (`openssl rand -hex 8`), `DATABASE_PATH=/tmp/portal.db`
6. Deploy — na Vercel o SQLite roda em **memória** (sem disco persistente). Para persistência use Postgres/Neon/Turso.

Clique em Deploy e pronto!

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone https://github.com/LucasBorges4/recipe-plan-studio.git
cd recipe-plan-studio
npm i
npm run dev
```

## Backend & Autenticação

O portal possui backend completo com persistência em banco de dados e
autenticação real (substitui o antigo estado em `localStorage`).

- **Banco de dados**: SQLite embutido (`node:sqlite`, sem dependências nativas)
  apontado por `DATABASE_PATH` (padrão `.data/portal.db`). Sem disco gravável,
  cai para SQLite em memória — os dados reiniciam a cada instância e o payload
  sinaliza `persistent: false`.
- **Senhas**: Argon2id (`hash-wasm`) com **salt** por usuário (16 bytes) e
  **pepper** global injetado como `secret` do Argon2 (keyed hashing). O pepper
  vem de `AUTH_PEPPER` ou é gerado e persistido na tabela `meta`. O login é
  _timing-safe_ (hash dummy quando o e-mail não existe).
- **Sessões**: cookie `httpOnly` `geos_session` com token opaco; o banco guarda
  apenas o SHA-256 do token.
- **Papéis (RBAC)**: `admin`, `diretor`, `gestor`, `desenvolvedor`, `auditor`.
  A primeira conta criada torna-se `admin`; as demais começam como
  `desenvolvedor`. Toda mutação é revalidada no servidor.
- **Auditoria**: trilha somente-inserção de todas as ações relevantes.
- **API**: server functions (`@tanstack/react-start`) em `src/lib/portal-api.ts`
  consumidas via hooks em `src/lib/api-hooks.ts`.

Configuração em `.env.example`. Em produção defina `DATABASE_PATH` para volume persistente ou troque `Storage` por Postgres.

## Operação (produto final)

- **Variáveis**: `DATABASE_PATH=.data/portal.db`, `AUTH_PEPPER` (openssl rand -base64 32), `REGISTRATION_CODE` (convite), `STORAGE_REQUIRE_PERSISTENT=1` para falhar explícito se disco não gravável, `N8N_URL`/`N8N_PUBLIC_URL`/`N8N_API_KEY`.
- **Persistência**: `getStorageInfoFn`/`getPortalStateFn.persistent` expõe modo (persistente/volátil, caminho, initError). Com `STORAGE_REQUIRE_PERSISTENT=1` o servidor retorna 500 com aviso em vez de degradar silenciosamente para memória.
- **Backup**: `exportDatabaseFn` (admin) baixa JSON completo; `importDatabaseFn` restaura. `last_backup_at` em `meta`. Automático via `storage.exportDatabase()`/`importDatabase()`.
- **Checklist publicação (Admin)**: banco persistente ✅, primeiro admin criado ✅, convites configurados ✅, documentos legais com versão vigente (slug termos/lgpd) ✅, módulos cadastrados (vazio por padrão) ✅, próximos passos no banco ✅, patente 7 etapas no banco ✅.
- **Promover admin**: `admin@…` → Administração → Usuários → trocar role, ou seed `seedDemoUsersFn`.
- **Nenhuma tela lê `src/data` em runtime** — tudo via `getPortalStateFn` (`tasks, columns, controls, modules, risks, wiki, milestones, releases, patentStages, techStack, nextSteps, legalDocs`). `src/data` só semente inicial.
- **Datas ISO**: `nextSteps.due`, `legalDocs.publishedAt`, `milestones/releases` gravados `YYYY-MM-DD`, exibidos `formatBR`, ordenação cronológica, validação Zod `isoDateSchema`, `isFutureISO`.
