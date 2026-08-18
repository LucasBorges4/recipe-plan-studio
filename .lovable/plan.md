# Portal de Governança Corporativa — Grupo Geos

Aplicação web (TanStack Start + Tailwind) com layout de sidebar fixa escura, conteúdo claro, cabeçalhos com ícone + título + subtítulo, cards brancos com borda suave, badges de status coloridos e banner de aviso "dados de exemplo".

Estrutura de navegação (sidebar):
- Painel Executivo, Tarefas, Diário de Bordo, Compliance, Wiki, Mapa de Riscos, Engenharia e Equipe
- Grupo "LEGAL & ADMIN": Termos de Uso, Política LGPD, Patente, Administração

Cada funcionalidade abaixo segue o formato **Role + Task + Context + Constraints**.

---

## 1. Layout base e design system
- **Role:** Designer de sistemas de interface corporativa.
- **Task:** Criar shell da aplicação: sidebar escura (azul-marinho quase preto) com logo circular, nome "Grupo Geos" + subtítulo "Portal de Governança", itens com ícone e estado ativo destacado, rodapé "© 2026 Grupo Geos"; área de conteúdo clara com container centralizado.
- **Context:** Todas as páginas herdam esse shell; cabeçalho de página com ícone em quadro verde-claro, título grande e subtítulo cinza.
- **Constraints:** Tokens semânticos em `src/styles.css` (sem cores hardcoded), sidebar colapsável no desktop e drawer no mobile, tipografia sóbria (sem roxo/gradiente genérico), badges com paleta fixa: verde = Concluído, azul = Em Andamento, amarelo = Pendente, cinza = Aguardando, vermelho = Alta prioridade.

## 2. Painel Executivo
- **Role:** Analista de portfólio de projetos.
- **Task:** Página inicial (`/`) com card "Termômetro do Projeto" (gauge circular de % de conclusão), card "Módulos do Sistema" listando módulos (CRM, Fiscal e Tributário, Financeiro, Faturamento e Vendas, Compras e Suprimentos, Estoque, Gestão Eletrônica de Documentos) com badge de status, data, contador X/Y e barra de progresso, além de bloco inferior "Próximos Passos".
- **Context:** Visão geral do progresso do ERP em desenvolvimento; consumido pela diretoria.
- **Constraints:** Percentual derivado dos módulos (não valor fixo); linha de módulo clicável levando às tarefas filtradas; responsivo em duas colunas → uma coluna no mobile.

## 3. Tarefas (Kanban)
- **Role:** Gerente de entregas ágeis.
- **Task:** Board com colunas Backlog, A Fazer, Em Progresso, Em Aprovação, Concluído (contador por coluna), cards com título, descrição, tags de módulo, avatar do responsável, prazo com ícone, contador de comentários, faixa lateral colorida por prioridade e botões Aprovar/Rejeitar na coluna de aprovação. Barra superior: busca por título, filtros (prioridade, responsável, módulo), alternância board/lista, "Nova Coluna", "Nova Tarefa".
- **Context:** Tarefas nascem de composições de módulos e caminham até aprovação.
- **Constraints:** Arrastar e soltar entre colunas com persistência; aprovar move para Concluído e rejeitar volta para Em Progresso; coluna vazia mostra estado vazio ilustrado; modal de detalhe da tarefa com comentários.

## 4. Diário de Bordo
- **Role:** Cronista do projeto.
- **Task:** Timeline vertical de marcos (data, badge de tipo — Entrega, Integração, Marco, Decisão —, título, descrição) e painel lateral "Release Notes" com versões (v2.4.0, v2.3.1, v2.3.0), data e itens.
- **Context:** Histórico de evolução do projeto para consulta e auditoria.
- **Constraints:** Ordem cronológica decrescente; filtro por tipo de evento; conector visual entre pontos da timeline.

## 5. Compliance
- **Role:** Oficial de compliance.
- **Task:** Painel de controles de conformidade em cards/tabela: controle, norma de referência (LGPD, ISO, SOX), responsável, status, última revisão e próxima revisão, com indicadores de aderência no topo.
- **Context:** Acompanhamento de obrigações regulatórias do portal.
- **Constraints:** Destaque visual para controles vencidos; filtro por norma e por status; evidências anexáveis por controle.

## 6. Wiki
- **Role:** Curador de documentação técnica.
- **Task:** Base de conhecimento com índice por categorias, busca e página de artigo com sumário lateral e conteúdo em markdown.
- **Context:** Padrões de arquitetura, processos e decisões técnicas do ERP.
- **Constraints:** Artigos versionados com data de última atualização; navegação anterior/próximo; links internos entre artigos.

## 7. Mapa de Riscos
- **Role:** Gestor de riscos.
- **Task:** Matriz 5x5 (probabilidade x impacto) com riscos posicionados, mais lista detalhada: descrição, categoria, dono, severidade calculada e plano de mitigação.
- **Context:** Riscos técnicos, legais e de prazo do projeto.
- **Constraints:** Severidade = probabilidade x impacto com faixas de cor; clicar na célula filtra a lista; sem cores hardcoded fora dos tokens.

## 8. Engenharia e Equipe
- **Role:** Líder de engenharia.
- **Task:** Página com grade de cards de stack tecnológica (nome, subtítulo de categoria, ícone, descrição curta — ex. Redis/Cache, AWS/Cloud, Docker+K8s/DevOps, GitHub Actions/CI-CD) e seção "Quem Somos" com cards de pessoas: avatar com iniciais em círculo escuro, nome, função em verde, biografia e ícones de contato (LinkedIn, e-mail etc.).
- **Context:** Transparência sobre tecnologia e time responsável.
- **Constraints:** Grade de 4 colunas → 2 → 1; iniciais geradas do nome; links externos com `rel="noopener"`.

## 9. Patente do Sistema
- **Role:** Analista de propriedade intelectual.
- **Task:** Página de acompanhamento do processo no INPI: banner de aviso de dados de exemplo, card "Progresso Geral" com barra e "X de 7 etapas concluídas" + percentual, e etapas em lista vertical (Busca de Anterioridade, Redação do Pedido, Depósito no INPI, Exame Formal, Publicação na RPI, Exame Técnico, Concessão da Carta Patente) com ícone de estado, descrição, responsável e prazo, e badge de status à direita.
- **Context:** Registro do software junto ao INPI.
- **Constraints:** Progresso calculado das etapas; ícone e badge sempre coerentes com o status; ordem fixa das 7 etapas.

## 10. Termos de Uso e Política LGPD
- **Role:** Redator jurídico.
- **Task:** Páginas de documento com cabeçalho (título, subtítulo, "Última atualização" + badge de versão), banner de aviso, parágrafo introdutório e cláusulas numeradas em cards (Objeto, Acesso e Credenciais, Propriedade Intelectual, etc.).
- **Context:** Documentos institucionais internos do portal.
- **Constraints:** Conteúdo em estrutura de dados (não JSX solto) para facilitar edição; âncoras por cláusula; largura de leitura confortável.

## 11. Administração
- **Role:** Administrador do portal.
- **Task:** Área de gestão: usuários e papéis, módulos do sistema, colunas do Kanban e textos institucionais (versão dos documentos).
- **Context:** Alimenta os dados exibidos nas demais páginas.
- **Constraints:** Acesso restrito por papel; ações destrutivas com confirmação; alterações refletem imediatamente nas páginas consumidoras.

---

## Detalhes técnicos
- Rotas em `src/routes/`: `index.tsx` (Painel Executivo), `tarefas`, `diario`, `compliance`, `wiki` (+ `wiki/$slug`), `riscos`, `engenharia`, `termos`, `lgpd`, `patente`, `admin`. Layout compartilhado no `__root.tsx` com `<Outlet />`.
- `head()` próprio por rota com title/description/og únicos.
- Componentes reutilizáveis: `AppSidebar`, `PageHeader`, `StatusBadge`, `NoticeBanner`, `ProgressBar`, `KanbanBoard`, `TimelineItem`, `PersonCard`, `TechCard`, `RiskMatrix`.
- Fase 1 entrega todas as telas com dados de exemplo tipados em `src/data/*`. Fase 2 (a confirmar) liga Lovable Cloud para persistir tarefas, marcos, riscos, compliance, wiki, papéis e login.

## O que quero confirmar antes de construir
- Já nesta primeira etapa devo ativar o backend (banco + login) ou entregar as telas com dados de exemplo primeiro?
