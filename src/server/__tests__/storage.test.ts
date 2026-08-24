import { describe, it, expect } from "vitest";
import { SqliteStorage, MemoryStorage, type Storage, type UserRow } from "@/server/storage";
import type { Task, ComplianceControl, Module } from "@/data/types";
import type { EvidenceRecord, AuditEntry, CommentRecord } from "@/lib/records";

function factories(): { name: string; make: () => Promise<Storage> }[] {
  return [
    { name: "sqlite", make: async () => (await SqliteStorage.open(":memory:"))! },
    { name: "memory", make: async () => new MemoryStorage() },
  ];
}

function user(id: string, email: string, role: UserRow["role"]): UserRow {
  return {
    id,
    name: `Nome ${id}`,
    email,
    role,
    jobTitle: null,
    passwordHash: "hash",
    passwordSalt: "salt",
    createdAt: new Date().toISOString(),
  };
}

function task(id: string, column: string): Task {
  return {
    id,
    title: `Tarefa ${id}`,
    description: "",
    column,
    priority: "Média",
    tags: ["x"],
    assignee: "eu",
  };
}

describe.each(factories())("$name: usuários", ({ make }) => {
  it("insere, busca por e-mail (case-insensitive) e por id", async () => {
    const storage = await make();
    await storage.insertUser(user("u1", "A@B.com", "admin"));
    expect(await storage.countUsers()).toBe(1);
    const byEmail = await storage.getUserByEmail("a@b.com");
    expect(byEmail?.id).toBe("u1");
    expect((await storage.getUserById("u1"))?.role).toBe("admin");
  });

  it("atualiza papel e remove usuário", async () => {
    const storage = await make();
    await storage.insertUser(user("u2", "c@d.com", "desenvolvedor"));
    await storage.updateUser("u2", { role: "gestor" });
    expect((await storage.getUserById("u2"))?.role).toBe("gestor");
    await storage.deleteUser("u2");
    expect(await storage.getUserById("u2")).toBeNull();
  });

  it("getUserByEmail retorna null para inexistente", async () => {
    const storage = await make();
    expect(await storage.getUserByEmail("nao@existe.com")).toBeNull();
  });
});

describe.each(factories())("$name: colunas e tarefas", ({ make }) => {
  it("insere coluna única e rejeita duplicata", async () => {
    const storage = await make();
    expect(await storage.insertColumn("ColunaUnicaX")).toBe(true);
    expect(await storage.insertColumn("ColunaUnicaX")).toBe(false);
    expect(await storage.listColumns()).toContain("ColunaUnicaX");
  });

  it("deleteColumn é bloqueado enquanto houver tarefas", async () => {
    const storage = await make();
    await storage.insertColumn("ComTarefaY");
    await storage.insertColumn("VaziaZ");
    await storage.insertTask(task("tkY1", "ComTarefaY"));
    expect(await storage.countTasksInColumn("ComTarefaY")).toBe(1);
    expect(await storage.deleteColumn("ComTarefaY")).toBe(false);
    await storage.updateTaskColumn("tkY1", "VaziaZ");
    expect(await storage.deleteColumn("ComTarefaY")).toBe(true);
  });

  it("updateTaskColumn move a tarefa e retorna o registro atualizado", async () => {
    const storage = await make();
    await storage.insertColumn("OrigA");
    await storage.insertColumn("DestB");
    await storage.insertTask(task("tkA1", "OrigA"));
    const updated = await storage.updateTaskColumn("tkA1", "DestB");
    expect(updated?.column).toBe("DestB");
    expect((await storage.getTask("tkA1"))?.column).toBe("DestB");
  });

  it("updateTaskColumn retorna null para tarefa inexistente", async () => {
    const storage = await make();
    expect(await storage.updateTaskColumn("inexistente", "X")).toBeNull();
  });
});

describe.each(factories())("$name: comentários, controles, evidências, módulos", ({ make }) => {
  it("comentários: insere e lista", async () => {
    const storage = await make();
    const c: CommentRecord = {
      id: "c1",
      taskId: "t1",
      authorId: "u1",
      authorName: "Ana",
      at: new Date().toISOString(),
      body: "ok",
    };
    await storage.insertComment(c);
    const all = await storage.listComments();
    expect(all.find((x) => x.id === "c1")?.body).toBe("ok");
  });

  it("controles: insere e revisa", async () => {
    const storage = await make();
    const ctrl: ComplianceControl = {
      id: "ctrl1",
      control: "C",
      norm: "LGPD",
      owner: "Ana",
      status: "Pendente",
      tone: "warning",
      lastReview: "01/01/2024",
      nextReview: "01/07/2024",
    };
    await storage.insertControl(ctrl);
    await storage.reviewControl("ctrl1", {
      status: "Conforme",
      tone: "success",
      lastReview: "02/01/2024",
      nextReview: "02/07/2024",
      overdue: false,
    });
    const got = await storage.getControl("ctrl1");
    expect(got?.status).toBe("Conforme");
    expect(got?.nextReview).toBe("02/07/2024");
  });

  it("evidências: insere e revisa", async () => {
    const storage = await make();
    const ev: EvidenceRecord = {
      id: "ev1",
      controlId: "ctrl1",
      fileName: "doc.pdf",
      sentById: "u1",
      sentByName: "Ana",
      at: new Date().toISOString(),
      status: "Em revisão",
    };
    await storage.insertEvidence(ev);
    await storage.reviewEvidence("ev1", {
      status: "Aprovada",
      reviewerName: "Diretor",
      reviewedAt: new Date().toISOString(),
      note: "bom",
    });
    const got = await storage.getEvidence("ev1");
    expect(got?.status).toBe("Aprovada");
    expect(got?.reviewerName).toBe("Diretor");
  });

  it("módulos: insere e remove", async () => {
    const storage = await make();
    const m: Module = {
      id: "mod1",
      name: "ERP",
      status: "Aguardando início",
      tone: "neutral",
      date: "01/01/2024",
      done: 0,
      total: 0,
    };
    await storage.insertModule(m);
    expect(await storage.deleteModule("mod1")).toBe(true);
    expect(await storage.deleteModule("mod1")).toBe(false);
  });
});

describe.each(factories())("$name: auditoria", ({ make }) => {
  it("registra e lista entradas", async () => {
    const storage = await make();
    const entry: AuditEntry = {
      id: "aud1",
      at: new Date().toISOString(),
      actor: "Ana",
      actorId: "u1",
      actorRole: "admin",
      action: "Tarefa criada",
      entity: "tarefa",
      entityId: "t1",
      after: "feito",
    };
    await storage.insertAudit(entry);
    expect(await storage.countAudit()).toBeGreaterThanOrEqual(1);
    const all = await storage.listAudit();
    expect(all.some((a) => a.id === "aud1" && a.after === "feito")).toBe(true);
  });
});
