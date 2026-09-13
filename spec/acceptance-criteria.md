# Spec / Critérios de Aceitação

## AC-001: Autenticação
- Given: usuário com email e senha válidos
- When: POST `/login` com `email`, `password`
- Then: retorna `ok: true`, cookie `geos_session` setado, `PublicUser` com `id`, `name`, `email`, `role`

- Given: senha incorreta
- When: POST `/login`
- Then: retorna `ok: false`, `error: "E-mail ou senha inválidos."`, cookie removido

- Given: usuário não existe
- When: POST `/login`
- Then: retorna `ok: false`, `error: "E-mail ou senha inválidos."`, `userFound: false`

## AC-002: Cadastro
- Given: `REGISTRATION_CODE` configurado e código fornecido correto
- When: POST `/register`
- Then: usuário criado, `role: admin` se for o primeiro usuário, `session` criada

- Given: código inválido
- When: POST `/register`
- Then: `ok: false`, `error: "Código de cadastro inválido."`

## AC-003: RBAC
- Given: usuário com função `admin.manage`
- When: `grantUserFunction`
- Then: função adicionada ao usuário, `audit` registrado

## AC-004: Tarefas
- Given: usuário autenticado
- When: `createTaskFn`
- Then: tarefa criada na primeira coluna (`Backlog` se vazio)

- Given: tarefa existente
- When: `moveTaskFn` com `column: "Concluído"`
- Then: tarefa movida, `audit` com `before`/`after`

## AC-005: Comentários
- Given: tarefa existente e usuário autenticado
- When: `addCommentFn`
- Then: comentário inserido, `audit` registrado

## AC-006: Controles
- Given: usuário com `evidence.attach`
- When: `attachEvidenceFn`
- Then: evidência criada com `status: "Em revisão"`

- Given: evidência em revisão
- When: `reviewEvidenceFn` com `approved: true`
- Then: `status: "Aprovada"`, `reviewerName`, `reviewedAt`

## AC-007: Wiki / Docs / Legal
- Given: slug único
- When: `createWikiFn`
- Then: artigo inserido, `version: v1`

- Given: slug existente
- When: `createWikiFn` com mesmo slug
- Then: `ok: false`, `error: "Já existe um artigo com este slug."`

## AC-008: Riscos
- Given: `risk.manage` permitido
- When: `createRiskFn`
- Then: risco inserido, `audit` registrado

- Given: tarefas vencidas e controles vencidos
- When: `generateAutoRisksFn`
- Then: riscos auto-gerados para atrasos e vencimentos

## AC-009: Automação / Próximos Passos
- Given: `AutomationShare` existente
- When: `upsertAutomationShare`
- Then: compartilhamento atualizado ou inserido

- Given: `NextStep` ordenado
- When: `reorderNextSteps`
- Then: posições atualizadas conforme array `orderedIds`

## AC-010: Convites / Reset
- Given: convite válido e não usado
- When: `getInviteByHash`
- Then: retorna `InviteRow` com `usedAt: null`

- Given: convite expirado
- When: `getInviteByHash`
- Then: ainda retorna o convite (validação de expiração é feita pelo chamador)

- Given: token de reset válido
- When: `getResetTokenByHash`
- Then: retorna `ResetToken`

## AC-011: Auditoria
- Given: ação realizada (login, tarefa, controle, etc.)
- When: `insertAudit`
- Then: registro inserido com `id`, `at`, `actor_id`, `actor_name`, `actor_role`, `action`, `entity`, `entity_id`

- Given: `audit.read` permitido
- When: `listAuditFn`
- Then: retorna lista ordenada por `seq DESC`

## AC-012: N8n
- Given: `N8N_URL` configurado e `N8N_API_KEY` presente
- When: `n8nFetch` com `path: "/workflows"`
- Then: retorna array `N8nWorkflow[]`

- Given: workflow existente
- When: `updateN8nWorkflow(id, payload)`
- Then: retorna `N8nWorkflow` atualizado

- Given: usuário n8n não existe
- When: `provisionN8nUser`
- Then: usuário criado com `firstName`, `lastName`, `email`, `password`, `role`

## AC-013: Persistência / Diagnóstico
- Given: `STORAGE_REQUIRE_PERSISTENT=1`
- When: `getStorage()` e nenhum driver persistente abre
- Then: lança erro com mensagem de diagnóstico

- Given: runtime normal
- When: `storageDiagnosticFn`
- Then: retorna `env`, `postgresOpenError`, `tursoOpenError`, `storage` (kind, persistent, path, initError)

## AC-014: Login Logger
- Given: tentativa de login (sucesso ou falha)
- When: `logLoginAttempt`
- Then: arquivo `logs/login-attempts.jsonl` contém linha JSONL com `ts`, `email`, `ip`, `outcome`
