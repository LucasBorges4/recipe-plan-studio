# Concluir o portal: cadastros reais em todos os módulos + UI de uso diário

Hoje quatro módulos ainda leem arquivos fixos em `src/data/` (Riscos, Diário de Bordo, Engenharia e Equipe, Patente e Wiki): nada pode ser criado, editado ou salvo por quem usa o portal. Tarefas, Compliance, Módulos, Usuários e Auditoria já persistem no banco do servidor. O objetivo é fechar essa lacuna e deixar a interface pronta para uso real, no mesmo padrão visual atual.

## 1. Riscos (novo cadastro real)

- Tabela de riscos no banco com dono, probabilidade (1-5), impacto (1-5), severidade calculada, plano de mitigação, status (Aberto / Em tratamento / Mitigado / Aceito) e vínculo opcional com tarefas.
- Formulário em diálogo: "Novo risco" e "Editar risco", com validação (título, dono, escalas 1-5, plano obrigatório quando severidade for alta).
- Matriz 5x5 clicável: clicar numa célula filtra a lista; filtros por status, dono e severidade; busca por texto.
- Ações: registrar tratamento (histórico), mudar status, excluir (somente admin/diretor).
- Toda alteração gera registro na Auditoria.

## 2. Diário de Bordo e Release Notes (novo cadastro real)

- Tabelas de marcos e de releases.
- "Novo marco" (título, data, módulo, descrição, status) e "Nova release" (versão, data, itens da lista).
- Ordenação cronológica automática, filtro por módulo/ano, e estado vazio com chamada para criar o primeiro registro.
- Edição e exclusão com permissão por papel; tudo auditado.

## 3. Engenharia e Equipe (novo cadastro real)

- Tabelas de itens de stack tecnológico e de membros da equipe.
- "Adicionar tecnologia" (nome, categoria, versão, finalidade) e "Adicionar membro" (nome, cargo, especialidades, bio, e-mail, papel no portal).
- Vinculação opcional do membro a um usuário cadastrado, para que o nome apareça como responsável em tarefas.
- Cartões com iniciais mantidos como estão; ganham menu de editar/remover.

## 4. Patente (etapas reais)

- Tabela das 7 etapas do processo INPI com status, datas prevista/real, protocolo e observações.
- Edição por etapa em diálogo; a barra de progresso passa a refletir as etapas concluídas no banco.
- Registro de anexos/protocolo por etapa e histórico das mudanças na Auditoria.

## 5. Wiki (artigos versionados)

- Tabelas de artigos e de versões.
- Criar/editar artigo com categoria, resumo, corpo em Markdown simples e autor; cada salvamento cria nova versão.
- Lista de versões no artigo com autor/data e possibilidade de restaurar; busca por título/conteúdo e filtro por categoria.

## 6. Cadastro de acesso por link com código secreto

- Convites gerados por admin: código longo aleatório, papel pré-definido, validade e limite de uso, com link pronto para copiar.
- A página de criar conta passa a exigir o código (aceito também via link, já preenchido). Código inválido, expirado ou já usado é recusado com mensagem clara.
- Tela de administração dos convites: criar, copiar link, revogar, ver quem usou.
- A primeira conta do portal continua sendo admin sem convite; as demais exigem convite.

## 7. Acabamento de interface (usabilidade)

- Formulários padronizados em diálogo, com validação em tempo real, botão desabilitado durante o envio e mensagens de erro no campo.
- Estados de carregamento (skeleton) e estados vazios com ação principal em todas as listas.
- Confirmação antes de excluir; desfazer via toast quando aplicável.
- Busca e filtros persistidos na URL, para links compartilháveis.
- Barra superior com busca global (tarefas, riscos, artigos, controles) e atalho de teclado.
- Botões e ações escondidos quando o papel não permite, em vez de erro após o clique.
- Ajustes de responsividade (a navegação lateral e as tabelas em telas estreitas).

## Detalhes técnicos

- Novas tabelas em `src/server/storage.ts` (mesmo padrão de schema e `seed` atual), com métodos de leitura/escrita na interface `Storage`.
- Novos `createServerFn` em `src/lib/portal-api.ts`, com Zod estrito, `requirePermission` por papel e `logAudit` em toda escrita.
- `getPortalStateFn` estendido para trazer riscos, marcos, releases, stack, equipe, etapas de patente e índice do wiki numa única leitura; hooks em `src/lib/api-hooks.ts` com invalidação por mutação.
- Novas permissões em `src/lib/rbac.ts` (ex.: `risco:editar`, `wiki:publicar`, `convite:gerenciar`), cobertas por testes em `src/lib/__tests__/rbac.test.ts`.
- Arquivos de `src/data/` passam a ser apenas semente inicial do banco, não fonte de leitura das telas.
- Convites: tabela com hash do código (nunca em texto puro), tentativas limitadas por IP, e rota `/cadastro?convite=...`.
