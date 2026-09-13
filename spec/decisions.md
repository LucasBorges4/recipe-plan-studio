# Spec / Decisões

## DEC-001: SQLite como driver principal
- Tradeoff: SQLite embutido (`node:sqlite`) não requer processo externo, mas não escala para altas cargas concorrentes.
- Decisão: Manter SQLite como padrão local; Postgres/Neon para produção; Turso para edge/cloud.

## DEC-002: PostgresStorage estende SqliteBackend
- Tradeoff: Reutiliza SQL compartilhado, mas requer normalização (`toPg`, `normalizePgRow`, `SCHEMA` substituído).
- Decisão: Estender `SqliteBackend` com substituições (`ON CONFLICT DO NOTHING`, `ctid`, `LOWER`).

## DEC-003: MemoryStorage como fallback final
- Tradeoff: Dados perdidos a cada reinício; não exige `node:sqlite`.
- Decisão: Usar quando `SqliteStorage.open` falha e `STORAGE_REQUIRE_PERSISTENT` é falso.

## DEC-004: Cookie opaco (token aleatório) em vez de JWT
- Tradeoff: JWT é stateless, mas não pode ser revogado facilmente; token opaco permite revogação (`deleteSession`).
- Decisão: Token opaco 256 bits + hash SHA-256 no banco; cookie httpOnly.

## DEC-005: Pepper para Argon2id
- Tradeoff: Adiciona complexidade (env var `PEPPER`), mas aumenta segurança se o banco vazar.
- Decisão: Usar `PEPPER` via `process.env` ou meta no banco; `verifyPassword` inclui `pepper`.

## DEC-006: N8n via `fetch` direto com `X-N8N-API-KEY`
- Tradeoff: Sem SDK oficial; vulnerável a SSRF se URL não validada.
- Decisão: Implementar `validateN8nUrl`, `isBlockedIp`, `safeFetch` no `n8n.ts`.

## DEC-007: TDD obrigatório antes de correção
- Tradeoff: Aumenta tempo, mas garante que correções não quebram comportamento existente.
- Decisão: Escrever testes que falham (`RED`), corrigir (`GREEN`), refatorar (`REFACTOR`).

## DEC-008: Não alterar `.env` ou `.data/portal.db`
- Tradeoff: Restrições de segurança impedem manipulação de produção.
- Decisão: Só alterar código-fonte (`src/`); documentar baseline no relatório.

## DEC-009: Arquivos `spec/` e `graph/` criados do zero
- Tradeoff: Não existem no repo original; exigem análise independente.
- Decisão: Mapear requisitos diretamente de `src/` (não do repo similar no TecnoCAF).

## DEC-010: `postinstall` (`patch-unenv.mjs`)
- Tradeoff: Corrige compatibilidade de runtime; pode mascarar problemas.
- Decisão: Manter `postinstall`; documentar no relatório se causar falhas.
