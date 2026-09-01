# Finalização do Portal de Governança Grupo Geos — Prompt Estruturado

## ROLE
Você é o engenheiro sênior responsável pelo Portal de Governança do Grupo Geos: aplicação TanStack Start com backend próprio (SQLite via `node:sqlite`, rodando na VM Oracle), RBAC real, auditoria imutável e convites com código secreto.

## GOAL
Entregar o portal como produto final: sem dados estáticos residuais, com persistência garantida, cadastro/edição completos em todos os módulos e UX de painel de gestão (estilo ClickUp) coerente em toda a aplicação.

## TASK
1. Garantir persistência real e visível (nunca degradar silenciosamente para memória).
2. Eliminar os últimos conteúdos estáticos (Patente, Documentos Legais, Próximos Passos, lista de Módulos).
3. Completar o ciclo de vida do usuário (perfil, senha, sessões, convites).
4. Padronizar CRUD, datas reais e estados vazios/carregando em todos os módulos.
5. Validar entrega com checklist operacional dentro do Admin.

## CONTEXT
Estado verificado hoje no código:
- `src/server/storage.ts` (2.562 linhas) abre SQLite em `DATABASE_PATH`; se o caminho não for gravável cai para SQLite em memória e, no limite, para storage em memória — com `storageInitError` preenchido. Existe a flag `STORAGE_REQUIRE_PERSISTENT`.
- Módulos já persistidos no banco: tarefas, compliance, riscos, wiki, diário/releases, engenharia/time, convites, auditoria.
- Ainda com dados estáticos: `src/routes/patente.tsx` importa `patentStages` de `@/data/patent`; `src/routes/admin.tsx` importa `termsDoc`/`lgpdDoc` de `@/data/legal`; `src/data/modules.ts` alimenta módulos/próximos passos no dashboard.
- Componentes reutilizáveis disponíveis: `RecordForm.tsx` (RecordDialog + DeleteRecordButton), `StatusBadge`, `PageHeader`, `InvitesPanel`, `LegalDocPage`.
- RBAC em `src/lib/rbac.ts`; API cliente em `src/lib/portal-api.ts`; validação Zod em `src/lib/doc-schemas.ts`.

## CONSTRAINTS
- Não alterar a identidade visual (sidebar navy, cores semânticas de status, tipografia atual).
- Não ativar Lovable Cloud/Supabase nem qualquer serviço externo: apenas o backend existente.
- Nenhum stub, texto de demonstração, data fictícia ou "Teste — Tarefa NNN".
- Toda escrita passa por validação Zod no servidor e gera registro de auditoria imutável.
- Ações destrutivas e de aprovação restritas por papel (admin/diretor/gestor/dev/auditor).
- Nenhuma migração pode apagar dados já cadastrados pelo usuário.

## TOOLS
- Banco: tabelas SQLite em `src/server/storage.ts` (+ migrações idempotentes).
- API: `src/lib/portal-api.ts`, hooks em `src/lib/api-hooks.ts`, schemas em `src/lib/doc-schemas.ts`.
- UI: componentes de `src/components/portal/`, rotas em `src/routes/`.
- Testes: vitest (`src/server/__tests__`, `src/lib/__tests__`); verificação de UI via preview/Playwright.

## OUTPUT
- Código na árvore atual, sem novos serviços externos.
- Cada módulo com criar/editar/excluir funcional, validação e auditoria.
- Painel Admin com: status da persistência, backup/restore do banco, convites, checklist de entrega.
- Suíte de testes verde e build sem erros.

## WORKFLOW
**Passo 1 — Persistência auditável**
Expor `storageInitError` e o driver ativo (`sqlite`/`memory`) num banner no Admin; documentar `DATABASE_PATH` e ligar `STORAGE_REQUIRE_PERSISTENT` em produção; adicionar export/import do banco (backup/restore) com auditoria.

**Passo 2 — Patente no banco**
Criar tabela `patent_stages` com migração a partir de `@/data/patent` (uma vez, se vazia); CRUD com ordem, status e datas; remover o import estático de `patente.tsx`.

**Passo 3 — Documentos legais versionados**
Migrar Termos e LGPD para a tabela `docs`, com editor no Admin, versão, data de vigência e histórico; `termos.tsx`/`lgpd.tsx` passam a ler do banco via `LegalDocPage`.

**Passo 4 — Dashboard sem estático**
Mover módulos e "Próximos Passos" para o banco, com CRUD e ordenação; termômetro e KPIs derivados apenas de dados reais; estado vazio explicativo quando não houver registros.

**Passo 5 — Datas reais**
Substituir datas textuais (diário, releases, patente) por campos ISO com date picker, ordenação e filtros por período; formatação pt-BR na exibição.

**Passo 6 — Ciclo de vida do usuário**
Concluir `perfil.tsx` (nome, e-mail, troca de senha), gestão de usuários e papéis no Admin, listagem/revogação de sessões e fluxo de convite por e-mail com código secreto de uso único e expiração.

**Passo 7 — Polimento de UX**
Skeletons de carregamento, toasts de sucesso/erro, busca global, ocultar (não apenas desabilitar) ações sem permissão, e estados vazios com CTA em todos os módulos.

**Passo 8 — Validação de entrega**
Checklist no Admin (persistência OK, admin criado, documentos legais publicados, convites ativos), rodar testes, revisar auditoria de ponta a ponta e verificar cada rota no preview.
