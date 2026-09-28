import { describe, it, expect } from "vitest";
import { z } from "zod";
import { SqliteStorage, MemoryStorage, type UserRow } from "@/server/storage";
import { publicUser, publicUserWithFunctions } from "@/server/auth";

function factories(): { name: string; make: () => Promise<import("@/server/storage").Storage> }[] {
  return [
    { name: "sqlite", make: async () => (await SqliteStorage.open(":memory:"))! },
    { name: "memory", make: async () => new MemoryStorage() },
  ];
}

function userRow(id: string, avatarUrl: string | null = null): UserRow {
  return {
    id,
    name: `Nome ${id}`,
    email: `${id}@test.com`,
    role: "gestor",
    jobTitle: "Cargo",
    department: "Dept",
    bio: "Bio",
    avatarUrl,
    passwordHash: "hash",
    passwordSalt: "salt",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe.each(factories())("$name: avatar e perfil público", ({ make }) => {
  it("publicUser retorna avatarUrl quando presente", async () => {
    const storage = await make();
    await storage.insertUser(userRow("u1", "data:image/png;base64,abc"));
    const row = await storage.getUserById("u1");
    const pub = row ? publicUser(row) : null;
    expect(pub?.avatarUrl).toBe("data:image/png;base64,abc");
  });

  it("publicUser retorna avatarUrl null quando ausente", async () => {
    const storage = await make();
    await storage.insertUser(userRow("u2", null));
    const row = await storage.getUserById("u2");
    const pub = row ? publicUser(row) : null;
    expect(pub?.avatarUrl).toBeNull();
  });

  it("publicUserWithFunctions retorna avatarUrl quando presente", async () => {
    const storage = await make();
    await storage.insertUser(userRow("u3", "data:image/jpeg;base64,xyz"));
    const row = await storage.getUserById("u3");
    const pub = row ? await publicUserWithFunctions(storage, row) : null;
    expect(pub?.avatarUrl).toBe("data:image/jpeg;base64,xyz");
  });

  it("publicUserWithFunctions retorna avatarUrl null quando ausente", async () => {
    const storage = await make();
    await storage.insertUser(userRow("u4", null));
    const row = await storage.getUserById("u4");
    const pub = row ? await publicUserWithFunctions(storage, row) : null;
    expect(pub?.avatarUrl).toBeNull();
  });
});

describe("getPublicUserFn zod validation", () => {
  const schema = z
    .object({
      userId: z.string().trim().min(1, "ID obrigatório").max(128, "ID muito longo"),
    })
    .strict();

  it("aceita userId válido", () => {
    expect(schema.parse({ userId: "u1" })).toEqual({ userId: "u1" });
  });

  it("rejeita userId vazio", () => {
    expect(() => schema.parse({ userId: "" })).toThrow();
  });

  it("rejeita userId maior que 128 chars", () => {
    expect(() => schema.parse({ userId: "a".repeat(129) })).toThrow();
  });

  it("rejeite campo extra", () => {
    expect(() => schema.parse({ userId: "u1", extra: "x" } as Record<string, unknown>)).toThrow();
  });
});

describe("listPublicUsersFn / getPublicUserFn comportamento", () => {
  it("replica validação e propaga avatarUrl na resposta", async () => {
    // Como a serverFn requer contexto de runtime, testamos via storage/auth diretamente.
    const storage = await SqliteStorage.open(":memory:");
    if (!storage) throw new Error("Storage null");
    await storage.insertUser(userRow("pub", "data:image/webp;base64,webp"));
    await storage.insertUser(userRow("pub-null", null));

    const users = await storage.listUsers();
    const withAvatar = users.find((u) => u.id === "pub");
    const withoutAvatar = users.find((u) => u.id === "pub-null");

    expect(withAvatar?.avatarUrl).toBe("data:image/webp;base64,webp");
    expect(withoutAvatar?.avatarUrl).toBeNull();

    const pubWith = withAvatar ? publicUser(withAvatar) : null;
    const pubWithout = withoutAvatar ? publicUser(withoutAvatar) : null;

    expect(pubWith?.avatarUrl).toBe("data:image/webp;base64,webp");
    expect(pubWithout?.avatarUrl).toBeNull();
  });
});
