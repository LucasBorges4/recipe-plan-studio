# Recipe Blueprint

Faça o planejamento de uma aplicação web que contenha todas as caracteristicas apresentadas nas imagens, faça um detalhamento seguindo o formato de uma receita descrevendo cada uma das funcionalidades seguindo um paradigma de modelo assim como: Role + Task + Context + Constraints .

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://recipe-plan-studio.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8280048a-6b8b-4c47-982f-0069599a09e4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
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

Configuração em `.env.example`. Em produção no Lovable (runtime edge), defina
`DATABASE_PATH` para um volume persistente ou troque a implementação de
`Storage` (`src/server/storage.ts`) por Postgres/Lovable Cloud.
