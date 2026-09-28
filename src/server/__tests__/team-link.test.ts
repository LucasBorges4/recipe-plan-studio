import { describe, it, expect } from "vitest";
import { SqliteStorage, MemoryStorage, type Storage, type UserRow } from "@/server/storage";
import { publicUser } from "@/server/auth";
import { listTeamMembers } from "@/server/team-catalog";

function factories(): { name: string; make: () => Promise<Storage> }[] {
  return [
    { name: "sqlite", make: async () => (await SqliteStorage.open(":memory:"))! },
    { name: "memory", make: async () => new MemoryStorage() },
  ];
}

function userRow(id: string): UserRow {
  return {
    id,
    name: `Nome ${id}`,
    email: `${id}@test.com`,
    role: "gestor",
    jobTitle: "Cargo",
    department: "Dept",
    bio: "Bio",
    avatarUrl: null,
    passwordHash: "hash",
    passwordSalt: "salt",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe.each(factories())("$name: atrelagem de perfil de equipe", ({ make }) => {
  it("roundtrip: updateUser grava e limpa teamMemberId", async () => {
    const storage = await make();
    await storage.insertUser(userRow("u1"));
    await storage.updateUser("u1", { teamMemberId: "daniel-melo" });
    expect((await storage.getUserById("u1"))?.teamMemberId).toBe("daniel-melo");
    await storage.updateUser("u1", { teamMemberId: null });
    expect((await storage.getUserById("u1"))?.teamMemberId).toBeNull();
  });

  it("publicUser expõe teamMemberId e avatar automático via manifest", async () => {
    const storage = await make();
    await storage.insertUser({
      ...userRow("u2"),
      name: "Daniel Melo",
      avatarUrl: null,
      teamMemberId: "daniel-melo",
    });
    const row = await storage.getUserById("u2");
    const pub = row ? publicUser(row) : null;
    expect(pub?.teamMemberId).toBe("daniel-melo");
    expect(pub?.avatarUrl).toBe("/team/daniel-melo.png");
  });

  it("publicUser mantém avatar explícito mesmo com foto de equipe disponível", async () => {
    const storage = await make();
    await storage.insertUser({
      ...userRow("u4"),
      name: "Daniel Melo",
      avatarUrl: "data:image/jpeg;base64,xyz",
    });
    const row = await storage.getUserById("u4");
    const pub = row ? publicUser(row) : null;
    expect(pub?.avatarUrl).toBe("data:image/jpeg;base64,xyz");
  });

  it("listTeamMembers enriquece com vínculos reais (registered/email)", async () => {
    const storage = await make();
    await storage.insertUser({ ...userRow("u3"), name: "Daniel Melo", teamMemberId: "daniel-melo" });
    const list = await listTeamMembers(storage);
    const daniel = list.find((m) => m.id === "daniel-melo");
    expect(daniel?.registered).toBe(true);
    expect(daniel?.email).toBe("u3@test.com");
    const gerson = list.find((m) => m.id === "gerson");
    expect(gerson?.registered).toBe(false);
    expect(gerson?.linkedUserId).toBeNull();
  });
});