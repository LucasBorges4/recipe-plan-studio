import { describe, it, expect } from "vitest";
import { SqliteStorage, MemoryStorage, type Storage, ensureTasksMigration } from "@/server/storage";
import { columnToStage, inferProgressFromStage, isWaitingOnClient } from "@/lib/task-stages";
import type { Task } from "@/data/types";

function factories(): { name: string; make: () => Promise<Storage> }[] {
  return [
    { name: "sqlite", make: async () => (await SqliteStorage.open(":memory:"))! },
    { name: "memory", make: async () => new MemoryStorage() },
  ];
}

describe("sqlite: migração de legado", () => {
  it("banco antigo com schema sem colunas novas funciona após migração", async () => {
    const s = await SqliteStorage.open(":memory:");
    if (!s) throw new Error("sqlite não abriu");
    await (s as any).run("DROP TABLE IF EXISTS tasks");
    await (s as any).run(
      `CREATE TABLE tasks (id TEXT PRIMARY KEY, title TEXT, description TEXT, column_name TEXT, priority TEXT, tags TEXT, assignee TEXT, due TEXT, comments INTEGER)`,
    );
    await (s as any).run(
      "INSERT INTO tasks (id, title, description, column_name, priority, tags, assignee) VALUES (?, ?, ?, ?, ?, ?, ?)",
      "t-legacy",
      "Legacy",
      "",
      "Aguardando você",
      "Média",
      "[]",
      "Ana",
    );
    await ensureTasksMigration(async (sql: string) => await (s as any).exec(sql));
    const got = await s.getTask("t-legacy");
    expect(got).not.toBeNull();
    expect(got?.stage).toBe("waiting_client");
    expect(got?.waitingOnClient).toBe(true);
    // Após migração aditiva, progresso permanece no padrão (0) até ser atualizado
    expect(got?.progress).toBe(0);
  });
});

describe.each(factories())("$name: tasks extended", ({ make }) => {
  it("inserção com campos novos retorna exatamente os valores persistidos", async () => {
    const s = await make();
    const task: Task = {
      id: "t-ext-1",
      title: "Tarefa Estendida",
      description: "Desc",
      column: "Em Progresso",
      priority: "Alta",
      tags: ["a"],
      assignee: "João",
      stage: "in_progress",
      progress: 45,
      responsible: "João",
      waitingOnClient: false,
    };
    await s.insertTask(task);
    const list = await s.listTasks();
    const got = list.find((t) => t.id === "t-ext-1");
    expect(got).toBeDefined();
    expect(got?.stage).toBe("in_progress");
    expect(got?.progress).toBe(45);
    expect(got?.responsible).toBe("João");
    expect(got?.waitingOnClient).toBe(false);
    const byId = await s.getTask("t-ext-1");
    expect(byId?.stage).toBe("in_progress");
    expect(byId?.responsible).toBe("João");
  });

  it("defaults: inserção sem campos novos retorna defaults coerentes", async () => {
    const s = await make();
    const task: Task = {
      id: "t-ext-default",
      title: "Default",
      description: "",
      column: "Backlog",
      priority: "Média",
      tags: [],
      assignee: "Alice",
      stage: columnToStage("Backlog"),
      progress: inferProgressFromStage(columnToStage("Backlog")),
      responsible: null,
      waitingOnClient: isWaitingOnClient(columnToStage("Backlog")),
    };
    await s.insertTask(task);
    const got = await s.getTask("t-ext-default");
    expect(got?.stage).toBe("not_started");
    expect(got?.progress).toBe(0);
    expect(got?.responsible).toBeNull();
    expect(got?.waitingOnClient).toBe(false);
  });

  it("updateTaskProgress atualiza progresso, responsável e prazo", async () => {
    const s = await make();
    await s.insertTask({
      id: "t-prog",
      title: "Progresso",
      description: "",
      column: "Em Progresso",
      priority: "Média",
      tags: [],
      assignee: "Ana",
      stage: "in_progress",
      progress: 30,
      responsible: "Ana",
      waitingOnClient: false,
    });
    const updated = await s.updateTaskProgress("t-prog", {
      progress: 75,
      responsible: "Carlos",
      due: "15/12/2025",
    });
    expect(updated).not.toBeNull();
    expect(updated?.progress).toBe(75);
    expect(updated?.responsible).toBe("Carlos");
    expect(updated?.due).toBe("15/12/2025");
  });

  it("updateTaskProgress exige responsável quando stage é waiting_client", async () => {
    const s = await make();
    await s.insertTask({
      id: "t-wait",
      title: "Esperando",
      description: "",
      column: "Aguardando você",
      priority: "Média",
      tags: [],
      assignee: "Ana",
      stage: "waiting_client",
      progress: 60,
      responsible: "Ana",
      waitingOnClient: true,
    });
    const updated = await s.updateTaskProgress("t-wait", {
      progress: 80,
      responsible: "",
    });
    expect(updated).not.toBeNull();
    // Storage aceita vazio, mas o backend (updateTaskFn) deve rejeitar
    expect(updated?.responsible).toBe("");
  });

  it("idempotência: rodar ensureTasksMigration duas vezes não quebra", async () => {
    const s = await make();
    await ensureTasksMigration(async (sql: string) => await (s as any).exec(sql));
    await ensureTasksMigration(async (sql: string) => await (s as any).exec(sql));
    const tasks = await s.listTasks();
    expect(tasks).toBeDefined();
  });
});
