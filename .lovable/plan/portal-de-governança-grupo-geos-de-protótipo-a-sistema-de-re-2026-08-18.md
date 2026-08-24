# Portal de Governança Grupo Geos — de protótipo a sistema de registro

Objetivo: manter a identidade visual e todas as telas atuais, e substituir os dados de exemplo por uma base persistente, com login, papéis reais, histórico imutável e datas calculadas automaticamente.

Nada é reescrito visualmente. A cada fase, as páginas existentes passam a ler do banco em vez de `src/data/*`.

---

## Fase 1 — Fundação (esta entrega)

Ativar o backend (Lovable Cloud) e criar a base de identidade e autorização.

- Login com e-mail/senha, tela `/auth` e proteção de todas as páginas do portal (exceto Termos e LGPD, que continuam públicas).
- Perfis de usuário (nome, cargo, squad, avatar por iniciais).
- RBAC real com validação no banco: `admin`, `diretor`, `gestor`, `desenvolvedor`, `auditor`.
- Papéis em tabela separada + função de verificação no banco; nenhuma permissão fica só na interface.
- Tabela de auditoria (`audit_logs`) criada já nesta fase, com registro de login, criação/alteração de usuários e mudanças de papel.
- Página Administração passa a gerenciar usuários e papéis de verdade (com confirmação em ações destrutivas).
- Cabeçalho da sidebar mostra o usuário logado e permite sair.

### Matriz de papéis (para aprovação)

| Ação                                 | Admin | Diretor | Gestor | Dev | Auditor |
| ------------------------------------ | ----- | ------- | ------ | --- | ------- |
| Ver painel, riscos, compliance, wiki | ✔     | ✔       | ✔      | ✔   | ✔       |
| Criar/editar tarefas                 | ✔     | –       | ✔      | –   | –       |
| Atualizar status da própria tarefa   | ✔     | –       | ✔      | ✔   | –       |
| Aprovar/rejeitar tarefa              | ✔     | ✔       | –      | –   | –       |
| Anexar evidência                     | ✔     | –       | ✔      | ✔   | –       |
| Revisar/aprovar evidência            | ✔     | ✔       | –      | –   | –       |
| Editar wiki                          | ✔     | –       | ✔      | ✔   | –       |
| Aprovar versão de wiki               | ✔     | ✔       | –      | –   | –       |
| Gerenciar usuários, papéis, módulos  | ✔     | –       | –      | –   | –       |
| Ver auditoria e gerar relatórios     | ✔     | ✔       | –      | –   | ✔       |
| Apagar auditoria                     | –     | –       | –      | –   | –       |

### Schema da Fase 1 (para aprovação)

```text
profiles(id → auth.users, full_name, job_title, squad, email, created_at)
app_role  enum: admin | diretor | gestor | desenvolvedor | auditor
user_roles(id, user_id, role, granted_by, granted_at)   unique(user_id, role)
has_role(_user_id, _role) → boolean   (security definer)
audit_logs(id, actor_id, action, entity, entity_id, before jsonb, after jsonb, created_at)
```

Regras de acesso: cada usuário lê o próprio perfil e os perfis da organização; só admin altera papéis; `audit_logs` é somente inserção — ninguém pode editar ou apagar; leitura restrita a admin, diretor e auditor.

---

## Fases seguintes (ordem acordada)

2. **Governança** — módulos, entregáveis, tarefas, comentários e `task_history` no banco; Kanban com drag-and-drop persistido; fluxo de aprovação/rejeição gravado com quem, quando e o que mudou; Diário de Bordo alimentado por marcos reais.
3. **Compliance operacional** — controles com requisito, responsável, ciclo de revisão e validade; evidências com arquivo, hash, remetente, revisor e status; status calculado (Conforme / Próximo do vencimento / Vencido / Não conforme) a partir da data atual, sem depender de alteração manual; revisão vencida gera pendência automática.
4. **Riscos** — probabilidade × impacto = score com faixas, ações preventivas e de contingência, e vínculo bidirecional risco ↔ tarefas.
5. **Conhecimento** — wiki com versões, autor, revisor, changelog, aprovação e aviso "alterado desde a última aprovação".
6. **Executivo** — KPIs derivados dos dados reais: entregáveis por estado (concluídos, em andamento, atrasados, bloqueados, não iniciados) e semáforo de saúde (prazo, orçamento, escopo, segurança, compliance, qualidade), cada indicador clicável para a origem.
7. **Segurança** — MFA, sessões revogáveis, rate limiting no login, validação server-side em todas as escritas, CSP e revisão de políticas de acesso.
8. **Produção** — notificações in-app e por e-mail, relatórios de auditoria, testes dos fluxos críticos e domínio próprio (ex. `portal.grupogeos.com.br`).

Dados de teste ("Teste — Tarefa 212", "teste-imodulo") são descartados na Fase 2, quando o Kanban passa a ler do banco.

---

## Detalhes técnicos

- Backend: Lovable Cloud (Postgres + auth + storage). Toda leitura sensível passa por server functions autenticadas; nenhuma chave secreta no frontend.
- Rotas protegidas migram para `src/routes/_authenticated/*` mantendo os mesmos caminhos visíveis; `termos` e `lgpd` seguem públicas.
- Permissão é sempre verificada no banco via `has_role`; a interface apenas reflete o resultado.
- Datas vencidas são calculadas por consulta/coluna derivada, nunca por status escrito à mão.
- `src/data/*` vira semente inicial e é removido módulo a módulo conforme cada fase liga ao banco.
- Auditoria escrita por gatilhos/handlers no servidor, não pelo cliente.
