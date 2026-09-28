# Rebranding GWG + Deploy — Relatório de Execução

- **Data:** 2026-09-13
- **Repo:** `/home/opc/github/ok/recipe-plan-studio` (remote `LucasBorges4/recipe-plan-studio`)
- **Executor:** IA via OpenCode (thinkingmachines/inkling:free) + migração de dados dirigida pelo orquestrador

---

## 1. Resumo do rebrand

Nova identidade aplicada em todo o código e nos dados persistidos:

| Forma                       | Texto                                                                |
| --------------------------- | -------------------------------------------------------------------- |
| Nome completo               | `GWG — Grupo W. Geotec — Geociências Aplicadas e Tecnologias`        |
| Forma curta (sidebar/login) | `GWG — Grupo W. Geotec`                                              |
| Rodapé                      | `© 2026 GWG — Grupo W. Geotec · Geociências Aplicadas e Tecnologias` |
| Domínio de e-mail amostral  | `@grupogwg.com.br`                                                   |

### Código (26 arquivos modificados)

- **UI/branding:** `src/components/portal/AppSidebar.tsx` (constantes `GWG_FULL`/`GWG_SHORT`/`GWG_EMAIL_DOMAIN`, logo, header, rodapé), `src/routes/login.tsx`.
- **SEO/páginas:** títulos e `meta description` via `Head` em `src/routes/{__root,admin,auditoria,automacoes,compliance,diario,engenharia,index,lgpd,perfil,riscos,tarefas,termos,wiki.*}.tsx`.
- **CSV de auditoria:** `src/routes/auditoria.tsx` → `auditoria-gwg.csv`.
- **Placeholders de e-mail:** `InvitesPanel.tsx`, `admin.tsx`, `login.tsx` → `@grupogwg.com.br`.
- **Seed de usuários:** `src/lib/portal-api.ts` → nomes `Admin GWG`/`Diretoria GWG`/`Gestor GWG`/`Dev GWG`/`Auditor GWG` e emails `*.@grupogwg.com.br`.
- **Dados legais (fonte):** `src/data/legal.ts`.
- **Testes:** `src/server/__tests__/{login-flow,n8n-login-flow}.test.ts`, `src/lib/__tests__/registration-code.test.ts` (fixtures `@grupogwg.com.br`, `GWG2026`, `GWG@2026!`).
- **Docs:** `spec/`, `reports/`.

### Dados persistidos (Postgres local `127.0.0.1:5433/portal`)

Migração com backup prévio (`/tmp/opencode_rebrand_backup.json`) e transação:

- `legal_docs` (2 documentos, 6 campos): `Grupo Geos`/`Grupo W. Geotec CAFUFV` → identidade completa GWG.
- `users` (1): `Admin Geos` → `Admin GWG`; `admin@grupogeos.com.br` → `admin@grupogwg.com.br`.
- `tasks` (2): `assignee "Admin Geos"` → `Admin GWG`.
- `audit` (67): `entity_id admin@grupogeos.com.br` → `admin@grupogwg.com.br`; `actor_name Admin Geos` → `Admin GWG`.
- **Resultado:** 0 ocorrências residuais de `geos`/`Grupo Geos` em todo o banco.

## 2. Qualidade (Quality Gate)

- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm test`: **193/193 testes PASS** (14 arquivos, `n8n` SSRF incl.)
- `npm run build`: PASS (`.output` regerado)

## 3. Rebuild + Restart (produção)

|             | Antes                                 | Depois                      |
| ----------- | ------------------------------------- | --------------------------- |
| Gerenciador | pm2 (app `recipe-plan-studio`, id 16) | pm2 (mesmo app)             |
| PID         | 2746371                               | **38908**                   |
| Porta       | 3001                                  | 3001                        |
| Estado      | online                                | **online** (restart núm. 9) |

- **Rebuild:** `npm run build` (preset `node-server`), `.output` atualizado em 2026-09-13 18:12.
- **Restart:** `pm2 restart recipe-plan-studio` (por nome). Env preservado pelo pm2 (não foi preciso ler `/proc/<pid>/environ`).
- **Smoke test** (via curl local em `127.0.0.1:3001`, HTTP 200):
  - `/`, `/termos`, `/lgpd`, `/tarefas` → **0 ocorrências** de `Grupo Geos`/`grupogeos`/`Admin Geos`.
  - Conteúdo novo GWG confirmado no HTML SSR (sidebar, tiles, termos, LGPD, rodapé).

## 4. Não alterado (deliberadamente)

- `src/server/auth.ts`: cookie `geos_session` (interno; renomear invalidaria sessões).
- Identificadores internos `geos` em código (sem impacto visual).
- `.env` (nunca lido/imprimido; só usado para conectar ao banco sem expor segredos).
- `.lovable/plan/*.md` (histórico Lovable).
- Banco: `sessions` e outros dados de usuário de terceiros (`lucasborges7007@gmail.com`) permanecem intactos.
- Processos de terceiros (n8n :5679, capito, etc.).

## 5. Backlog / Notas

- **IMPORTANTE:** o e-mail de login do usuário admin seed mudou para `admin@grupogwg.com.br` (mesma senha). Confirmar com o proprietário antes de comunicar aos usuários.
- Rotação do `AUTH_PEPPER` (hardcoded em `src/server/__tests__/{login-flow,n8n-login-flow}.test.ts`) segue pendente — decisão do dono.
- Migração de dados foi dirigida pelo orquestrador porque a IA não tinha permissão de acesso a `/proc`/`/tmp`; o código e o deploy foram executados pela IA.
