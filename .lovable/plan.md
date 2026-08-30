# Prompt de fechamento: do portal atual ao produto final

Prompt pronto para execução, no formato Role + Task + Context + Constraints, cobrindo apenas o que ainda falta e o que já está disponível na plataforma.

## R — Role

Você é o engenheiro responsável por fechar o Portal de Governança do Grupo Geos como produto final: sem dados fixos em código, sem telas somente-leitura onde deveria haver cadastro, e com persistência confiável entre reinicializações.

## T — Task

Executar, nesta ordem, os itens abaixo.

### 1. Persistência confiável (bloqueio para produção)

Hoje o armazenamento escolhe SQLite em arquivo quando existe disco gravável e cai para SQLite **em memória** quando não existe — nesse modo os dados somem a cada reinício da instância e o portal só é demonstrável, não operável.

- Definir um caminho de banco persistente por variável de ambiente e falhar de forma explícita (tela/aviso de configuração) em vez de degradar silenciosamente para memória.
- Expor o modo atual de armazenamento na Administração (persistente / volátil, caminho em uso, data do último backup lógico).
- Rotina de exportação/importação completa do banco (JSON) na Administração, para migração e backup manual.

### 2. Remover os dados fixos restantes

- **Painel Executivo:** a lista de "Próximos passos" e o conjunto de módulos usado como reserva vêm de arquivo em código. Passar ambos para o banco, com cadastro/edição/exclusão e ordenação manual.
- **Termos de Uso e Política LGPD:** os dois documentos e a aba de documentos da Administração leem texto fixo. Passar para o banco como documentos versionados (título, versão, vigência, cláusulas), editáveis por admin/diretor, com histórico de versões e registro na Auditoria.
- **Patente:** garantir que as 7 etapas, prazos e protocolos vêm do banco e que a barra de progresso reflete o que está gravado.
- Após a migração, `src/data/` fica apenas como semente inicial; nenhuma tela lê de lá em runtime.

### 3. Datas de verdade

Diário de Bordo, Releases e demais registros aceitam data como texto livre ("Ex.: 12 Fev 2026"), o que impede ordenação e cálculos corretos.

- Campo de data com seletor, gravado em formato ISO, exibido em português.
- Ordenação cronológica real, filtro por período/ano e validação (sem datas futuras onde não faz sentido).
- Padronizar os prazos de Compliance e Patente no mesmo formato, mantendo o cálculo automático de vencido / próximo do vencimento.

### 4. Fechar o ciclo de conta e acesso

- Página de perfil: nome, cargo, e-mail e troca de senha da própria conta.
- Recuperação de acesso: admin gera link de redefinição de senha com código de uso único e validade.
- Convites: mostrar status (pendente / usado / revogado / expirado), quem usou e quando; reenviar link.
- Sessões: listar sessões ativas do usuário e permitir encerrar todas.

### 5. Acabamento de uso diário

- Estados vazios com ação principal e carregamento (skeleton) em todas as listas.
- Confirmação antes de excluir, com aviso de que a ação fica registrada na Auditoria.
- Busca global no topo (tarefas, riscos, artigos do wiki, controles) com atalho de teclado.
- Filtros e busca refletidos na URL, para links compartilháveis.
- Ações escondidas quando o papel não permite, em vez de erro após o clique.
- Revisão de responsividade da navegação lateral e das tabelas em telas estreitas.

### 6. Entrega

- Checklist de publicação na Administração: banco persistente, primeiro admin criado, convites configurados, documentos legais com versão vigente, módulos cadastrados.
- README de operação: variáveis de ambiente, como restaurar backup, como promover um admin.

## C — Context

Já funcionam sobre o banco e não devem ser reescritos: sessões por cookie httpOnly com token com hash, papéis e matriz de permissões (admin, diretor, gestor, desenvolvedor, auditor), Tarefas com Kanban arrastável e histórico, Compliance com evidências e revisão, Riscos, Wiki, Engenharia e Equipe, Módulos, Usuários, Convites por código secreto e a trilha de Auditoria somente-inserção com exportação CSV.

O que ainda não é produto final: persistência que pode virar volátil, três pontos com texto fixo em código (próximos passos, módulos de reserva, documentos legais), datas como texto livre, ausência de perfil/redefinição de senha e acabamento de usabilidade.

## C — Constraints

- Não alterar a identidade visual: mesma paleta, mesma navegação lateral, mesmos cartões e selos de status.
- Nenhuma tela pode voltar a ler arquivo de dados em runtime.
- Toda escrita valida papel no servidor e grava na Auditoria; o cliente apenas esconde botões.
- Nada de dado de demonstração: Tarefas, Diário e Releases continuam começando vazios.
- Códigos e senhas nunca em texto puro no banco; convites e redefinições sempre com hash e validade.
- Textos da interface em português do Brasil.
- Sem serviços externos novos: usar o backend próprio já existente.

## Detalhes técnicos

- Novas tabelas/registros em `src/server/storage.ts` (mesmo padrão de schema e semente atual), incluindo documentos legais versionados, próximos passos e tokens de redefinição de senha; métodos correspondentes na interface `Storage` e nos dois drivers.
- Novos `createServerFn` em `src/lib/portal-api.ts` com Zod estrito, `requirePermission` e `logAudit` em toda escrita; `getPortalStateFn` estendido para trazer os novos registros em uma leitura.
- `src/lib/doc-schemas.ts` ganha os esquemas de documento legal, próximo passo e data ISO; `src/lib/api-hooks.ts` ganha os hooks com invalidação por mutação.
- `src/routes/termos.tsx`, `src/routes/lgpd.tsx` e a aba de documentos de `src/routes/admin.tsx` passam a consumir os documentos do banco via `LegalDocPage`.
- Detecção de armazenamento em `src/server/storage.ts` passa a expor o modo (persistente/volátil) no payload de estado, consumido pela Administração.
- Testes: cobertura em `src/server/__tests__/storage.test.ts` para os novos registros e em `src/lib/__tests__` para normalização de datas e permissões novas.
