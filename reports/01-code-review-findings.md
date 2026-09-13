# Code Review — Findings

## Classificação
- IMPLEMENTATION_BUG: Erro de implementação que pode quebrar funcionalidade.
- TEST_BUG: Falta de cobertura ou teste incorreto.
- SECURITY_RISK: Risco de segurança (SSRF, vazamento, etc.).
- ARCHITECTURE_RISK: Problema arquitetural (dependências, escalabilidade, manutenção).

## Findings

### F-001: SSRF em n8nFetch (SECURITY_RISK) — CORRIGIDO
- Arquivo: `src/server/n8n.ts` (linha 84)
- Causa: `fetch` direto com URL construída de `n8nBaseUrl()` sem validação de IP, protocolo ou credenciais.
- Correção aplicada: `validateN8nUrl`, `isBlockedIp`, `safeFetch` implementados; testes adicionados.
- REQ relacionado: REQ-013
- AC relacionado: AC-012

### F-002: Falta de testes para n8nFetch (TEST_BUG) — CORRIGIDO
- Arquivo: `src/server/__tests__/n8n.test.ts` (novo)
- Causa: Nenhum teste direto para `n8nFetch`, `isBlockedIp`, `validateN8nUrl`.
- Correção aplicada: Testes criados (`RED` → `GREEN`).
- REQ relacionado: REQ-013
- AC relacionado: AC-012

### F-003: Falta de testes para updateUserPassword (TEST_BUG) — CORRIGIDO
- Arquivo: `src/server/__tests__/passwords-helpers.test.ts` (novo)
- Causa: Nenhum teste para `updateUserPassword` (interface `Storage.updateUserPasswordHash`).
- Correção aplicada: Teste de integração com `MemoryStorage`.
- REQ relacionado: REQ-002 / REQ-011
- AC relacionado: AC-002 / AC-011

### F-004: postinstall sobrescreve arquivo de node_modules (IMPLEMENTATION_BUG) — NÃO CORRIGIDO (documentado)
- Arquivo: `scripts/patch-unenv.mjs`
- Causa: Sobrescreve `node_modules/unenv/dist/runtime/node/sqlite.mjs`; pode quebrar com atualizações.
- Risco: Baixo (o patch é necessário para `node:sqlite` no runtime edge).
- Proposta: Migrar para patch via `pnpm.patchedDependencies` ou `patch-package`.
- REQ relacionado: REQ-014

### F-005: MemoryStorage como fallback final sem notificação explícita (ARCHITECTURE_RISK) — DOCUMENTADO
- Arquivo: `src/server/storage.ts` (linha 3022)
- Causa: Se `SqliteStorage` falha e não há Postgres, dados são perdidos. `getStorageInitError` expõe isso.
- Risco: Baixo a médio (documentado no relatório).
- Proposta: Adicionar alerta visual no frontend quando `persistent: false`.
- REQ relacionado: REQ-014
- AC relacionado: AC-013

### F-006: Login logger sem sanitização de email (SECURITY_RISK) — NÃO CORRIGIDO (baixo risco)
- Arquivo: `src/server/login-logger.ts` (linha 26)
- Causa: `email` é escrito diretamente no arquivo JSONL sem sanitização ou escape de quebras de linha.
- Risco: Baixo (arquivo local, não exposto via HTTP).
- Proposta: Sanitizar `email` antes de escrever (`email.replace(/\n/g, "")`).
- REQ relacionado: REQ-015

### F-007: PostgresStorage declara `kind = "sqlite"` (ARCHITECTURE_RISK) — NÃO CORRIGIDO (documentado)
- Arquivo: `src/server/postgres-storage.ts` (linha 30)
- Causa: `kind` retorna `"sqlite"` em vez de `"postgres"` ou `"postgres"` (deveria ser `"postgres"` para distinção).
- Risco: Baixo (não afeta funcionalidade, mas confunde diagnóstico).
- Proposta: Alterar para `kind = "postgres"`.
- REQ relacionado: REQ-014
