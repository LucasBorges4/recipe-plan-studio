# CI/CD — Portal GWG — Grupo W. Geotec

## Quality Gate (local, executado antes de qualquer deploy)

```bash
# 1. Verificação de tipos
bun run typecheck
# Resultado esperado: 0 erros NOVOS. Erros pré-existentes em arquivos não alterados pela mudança são aceitos
# (rbac.ts, rbac-profiles.test.ts, portal-api.ts, login-flow/n8n-login-flow.test.ts, storage.ts, vite.config.ts).

# 2. Testes
bun run test
# Resultado esperado: 248 PASS (236 originais + 12 novos: zaggo-redesign)

# 3. Build
bun run build
# Resultado esperado: PASS (gera `.output/`; não modifica `.env` ou `.data/`)

# 4. Lint (escopo apenas arquivos alterados/criados)
npx eslint src/server/n8n.ts src/lib/portal-api.ts src/routes/automacoes.tsx src/server/__tests__/*.test.ts --quiet
# Resultado esperado: 0 erros nos arquivos do escopo (erros pré-existentes em n8n.ts não fazem parte do escopo de limpeza)
```

## Fluxo de Deploy (documentado — não automatizado)

1. `bun run build` → gera `.output/`.
2. `pm2 restart recipe-plan-studio` (app na VM, porta 3001, nginx TLS `portal.163-176-45-217.sslip.io`).
3. `docker-compose -f docker-compose.n8n.yml up -d` (garante container `n8n-recipe`, imagem `n8n-custom-geos:latest`, volume `n8n_recipe_data`).
4. Smoke manual: acessar `/automacoes` no portal; verificar `iframe src` apontando para `https://163-176-45-217.sslip.io` (via `getN8nInfoFn`); criar workflow no n8n; confirmar CRUD (`list`, `get`, `create`, `update`, `delete`) funcionando via mock/testes; confirmar `provisionN8nUser` criando usuário no SQLite n8n (porta 3456); confirmar login portal→n8n com fallback argon2id (`email.auth-handler.js`) funcionando.

## Observações

- Não há `.github/workflows` configurado no repositório.
- `REGISTRATION_CODE` (`GEOS2026`) não é alterado por nenhum pipeline.
- `AUTH_PEPPER` não é exposto em logs ou outputs de build.
