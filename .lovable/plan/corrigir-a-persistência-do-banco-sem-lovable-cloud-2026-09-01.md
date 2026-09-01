# Corrigir a persistência do banco (sem Lovable Cloud)

## O que está acontecendo

O portal já usa SQLite embutido (`node:sqlite`) com caminho padrão `.data/portal.db`.
Só que a pasta `.data/` não existe no projeto e o driver nunca a cria: `DatabaseSync`
falha ao abrir o arquivo, o erro é engolido silenciosamente (`catch { return null }`)
e o sistema cai no modo em memória — daí o aviso "os dados serão perdidos a cada
reinício". Além disso o caminho é relativo, então depende do diretório de trabalho
do processo.

Conclusão: não é preciso banco externo nem Cloud. Basta garantir diretório e
caminho absoluto, e parar de esconder a falha real.

## Correções

1. **Caminho absoluto e estável** (`src/server/storage.ts` → `resolveDatabasePath`)
   - Mantém `DATABASE_PATH` como prioridade; quando relativo, resolve contra
     `process.cwd()` com `path.resolve` (sem `import.meta.url`, que quebra no edge).
   - Padrão continua `.data/portal.db`, agora resolvido para caminho absoluto.

2. **Criar o diretório antes de abrir** (`SqliteStorage.open`)
   - `mkdirSync(dirname(path), { recursive: true })` quando o caminho não é `:memory:`.
   - Se a criação falhar, seguir para as alternativas do passo 4.

3. **Não engolir o erro**
   - `SqliteStorage.open` passa a registrar a causa real (`console.error`) e a
     expor a mensagem para o bootstrap, para que o banner do Admin mostre o motivo
     concreto (permissão, FS somente leitura, `node:sqlite` ausente) em vez de um
     aviso genérico.

4. **Cadeia de fallback persistente antes de memória**
   - Ordem de tentativa: `DATABASE_PATH` → `<cwd>/.data/portal.db` → `/tmp/portal.db`.
   - Só cai em memória quando nenhuma delas abre; nesse caso a mensagem passa a
     citar o caminho e o erro que impediram a persistência.

5. **Sinalização correta na interface**
   - `getStorageInitError()` retorna a causa detalhada; o aviso já exibido no portal
     passa a mostrá-la. Quando o SQLite em arquivo abre, o aviso desaparece.

6. **Configuração e repositório**
   - `.gitignore`: ignorar `.data/` (arquivo do banco, `-wal`, `-shm`).
   - `.env.example`: documentar `DATABASE_PATH` e `STORAGE_REQUIRE_PERSISTENT=1`
     para ambientes onde a volatilidade deve ser um erro fatal (ex.: a VM Oracle).

## Validação

- Reiniciar o dev server e conferir no log `[portal] SQLite persistente em <caminho>`.
- Confirmar que `.data/portal.db` foi criado.
- Criar um registro (ex.: uma tarefa), reiniciar o servidor e verificar que o
  registro continua lá — prova de persistência real.
- Conferir que o banner de armazenamento volátil não aparece mais no portal.

## Observações técnicas

- Nenhuma dependência nova: `node:sqlite`, `node:fs` e `node:path` são embutidos.
- Nada de Lovable Cloud, Supabase ou serviço externo.
- Sem alteração de identidade visual e sem apagar dados existentes.
- Em runtime edge (workerd) `node:sqlite` pode não existir; nesse cenário o
  aviso continuará aparecendo com a causa explícita, e a execução em Node
  (VM Oracle / dev) usa o arquivo normalmente.
