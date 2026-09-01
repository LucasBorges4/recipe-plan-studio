import { describe, it, expect } from "vitest";
import { SqliteStorage, MemoryStorage, type Storage } from "@/server/storage";
import type { Risk, WikiArticle, Milestone, Release, PatentStage } from "@/data/types";

function factories(): { name: string; make: () => Promise<Storage> }[] {
  return [
    { name: "sqlite", make: async () => (await SqliteStorage.open(":memory:"))! },
    { name: "memory", make: async () => new MemoryStorage() },
  ];
}

describe.each(factories())("$name: perfis e clearAllUsers", ({ make }) => {
  it("persiste department/bio e limpa base", async () => {
    const s = await make();
    await s.insertUser({
      id: "u10",
      name: "Ana",
      email: "ana@x.com",
      role: "gestor",
      jobTitle: "Gestora",
      department: "Operações",
      bio: "Lidera operações",
      passwordHash: "h",
      passwordSalt: "s",
      createdAt: new Date().toISOString(),
    });
    const got = await s.getUserByEmail("ana@x.com");
    expect(got?.department).toBe("Operações");
    expect(got?.bio).toBe("Lidera operações");
    await s.updateUser("u10", { department: "TI", bio: "Nova bio" });
    expect((await s.getUserById("u10"))?.department).toBe("TI");
    expect(await s.clearAllUsers()).toBe(1);
    expect(await s.countUsers()).toBe(0);
    expect(await s.getUserById("u10")).toBeNull();
  });

  it("sessão única por usuário (deleteSessionsForUser)", async () => {
    const s = await make();
    await s.insertUser({
      id: "uS",
      name: "S",
      email: "s@x.com",
      role: "admin",
      jobTitle: null,
      department: null,
      bio: null,
      passwordHash: "h",
      passwordSalt: "s",
      createdAt: new Date().toISOString(),
    });
    await s.insertSession({
      tokenHash: "h1",
      userId: "uS",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1e6).toISOString(),
    });
    await s.insertSession({
      tokenHash: "h2",
      userId: "uS",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1e6).toISOString(),
    });
    await s.deleteSessionsForUser("uS");
    expect(await s.getSessionByTokenHash("h1")).toBeNull();
    expect(await s.getSessionByTokenHash("h2")).toBeNull();
    await s.insertSession({
      tokenHash: "h3",
      userId: "uS",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1e6).toISOString(),
    });
    expect((await s.getSessionByTokenHash("h3"))?.userId).toBe("uS");
  });
});

describe.each(factories())("$name: risks", ({ make }) => {
  it("CRUD de riscos", async () => {
    const s = await make();
    const r: Risk = {
      id: "r1",
      title: "Risco X",
      category: "Prazo",
      owner: "Ana",
      role: "gestor",
      probability: 3,
      impact: 4,
      mitigation: "Mitigar X com plano detalhado",
    };
    await s.insertRisk(r);
    expect((await s.getRisk("r1"))?.title).toBe("Risco X");
    await s.updateRisk("r1", { title: "Risco X2" });
    expect((await s.getRisk("r1"))?.title).toBe("Risco X2");
    expect((await s.listRisks()).length).toBe(1);
    expect(await s.deleteRisk("r1")).toBe(true);
    expect(await s.getRisk("r1")).toBeNull();
  });
});

describe.each(factories())("$name: wiki", ({ make }) => {
  it("CRUD de wiki", async () => {
    const s = await make();
    const w: WikiArticle = {
      slug: "t",
      title: "T",
      category: "Geral",
      summary: "S",
      updatedAt: "01/01/2026",
      version: "v1",
      sections: [{ heading: "H", body: "B" }],
    };
    await s.insertWiki(w);
    expect((await s.getWiki("t"))?.title).toBe("T");
    await s.updateWiki("t", { title: "T2" });
    expect((await s.getWiki("t"))?.title).toBe("T2");
    expect((await s.listWiki()).length).toBe(1);
    expect(await s.deleteWiki("t")).toBe(true);
    expect(await s.getWiki("t")).toBeNull();
  });
});

describe.each(factories())("$name: journal", ({ make }) => {
  it("milestones e releases", async () => {
    const s = await make();
    const m: Milestone = {
      id: "m1",
      date: "01 Jan 2026",
      type: "Marco",
      title: "M",
      description: "D detalhada aqui",
    };
    await s.insertMilestone(m);
    expect((await s.listMilestones()).length).toBe(1);
    expect(await s.deleteMilestone("m1")).toBe(true);
    const rel: Release = { version: "v9.9.9", date: "01 Jan 2026", items: ["a", "b"] };
    await s.insertRelease(rel);
    expect((await s.listReleases()).some((r) => r.version === "v9.9.9")).toBe(true);
    expect(await s.deleteRelease("v9.9.9")).toBe(true);
  });
});

describe.each(factories())("$name: patent", ({ make }) => {
  it("CRUD de patente", async () => {
    const s = await make();
    const p: PatentStage = {
      id: "p1",
      title: "Etapa",
      description: "Desc",
      owner: "INPI",
      deadline: "01 Jan 2027",
      status: "Pendente",
    };
    await s.insertPatentStage(p);
    expect((await s.getPatentStage("p1"))?.status).toBe("Pendente");
    await s.updatePatentStage("p1", { status: "Concluído" });
    expect((await s.getPatentStage("p1"))?.status).toBe("Concluído");
    expect((await s.listPatentStages()).length).toBe(1);
  });
});

describe.each(factories())("$name: funções por usuário (user_functions)", ({ make }) => {
  async function user(s: Storage, id = "uF1") {
    await s.insertUser({
      id,
      name: "Fulano",
      email: `${id}@x.com`,
      role: "gestor",
      jobTitle: null,
      department: null,
      bio: null,
      passwordHash: "h",
      passwordSalt: "s",
      createdAt: new Date().toISOString(),
    });
    return id;
  }

  it("concede, lista e revoga funções de um usuário", async () => {
    const s = await make();
    const uid = await user(s);
    expect(await s.grantUserFunction(uid, "tasks.approve", "Aprovar tarefas", "admin1")).toBe(true);
    expect(await s.grantUserFunction(uid, "risk.manage", "Gerenciar riscos", "admin1")).toBe(true);

    const list = (await s.listUserFunctions(uid)).sort((a, b) =>
      a.functionKey.localeCompare(b.functionKey),
    );
    expect(list.map((f) => f.functionKey)).toEqual(["risk.manage", "tasks.approve"]);
    expect(list[0]!.description).toBe("Gerenciar riscos");
    expect(list[0]!.grantedBy).toBe("admin1");
    expect(list[0]!.grantedAt).toBeTruthy();

    expect(await s.revokeUserFunction(uid, "risk.manage")).toBe(true);
    expect(await s.revokeUserFunction(uid, "risk.manage")).toBe(false);
    expect(await s.listUserFunctions(uid)).toHaveLength(1);
  });

  it("concessão duplicada é idempotente (retorna false)", async () => {
    const s = await make();
    const uid = await user(s);
    expect(await s.grantUserFunction(uid, "tasks.approve", "Aprovar", null)).toBe(true);
    expect(await s.grantUserFunction(uid, "tasks.approve", "Aprovar", null)).toBe(false);
    expect(await s.listUserFunctions(uid)).toHaveLength(1);
  });

  it("deleteUser remove as funções do usuário (cascade)", async () => {
    const s = await make();
    const uid = await user(s);
    const uid2 = await user(s, "uF2");
    await s.grantUserFunction(uid, "tasks.approve", "Aprovar", null);
    await s.grantUserFunction(uid2, "risks.manage", "Riscos", null);
    await s.deleteUser(uid);
    expect(await s.listUserFunctions(uid)).toHaveLength(0);
    expect(await s.listUserFunctions(uid2)).toHaveLength(1);
  });

  it("funções de usuários diferentes não se misturam", async () => {
    const s = await make();
    await user(s, "uF3");
    await user(s, "uF4");
    await s.grantUserFunction("uF3", "tasks.approve", "Aprovar", null);
    expect(await s.listUserFunctions("uF4")).toHaveLength(0);
  });

  it("sobrevive a exportDatabase/importDatabase", async () => {
    const s = await make();
    const uid = await user(s);
    await s.grantUserFunction(uid, "tasks.approve", "Aprovar", "admin1");
    const dump = await s.exportDatabase();
    expect(dump.userFunctions).toHaveLength(1);
    expect(dump.userFunctions[0]!.functionKey).toBe("tasks.approve");

    const s2 = await make();
    await s2.importDatabase(dump);
    const got = await s2.listUserFunctions(uid);
    expect(got).toHaveLength(1);
    expect(got[0]!.grantedBy).toBe("admin1");
  });

  it("clearAllUsers remove as funções junto com os usuários (cascade)", async () => {
    const s = await make();
    const uid = await user(s);
    await s.grantUserFunction(uid, "tasks.approve", "Aprovar", null);
    expect(await s.clearAllUsers()).toBe(1);
    expect(await s.listUserFunctions(uid)).toHaveLength(0);
  });
});
