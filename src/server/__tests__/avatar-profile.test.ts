import { describe, it, expect } from "vitest";
import { z } from "zod";
import { SqliteStorage, MemoryStorage, type Storage, type UserRow } from "@/server/storage";
import { publicUser, publicUserWithFunctions } from "@/server/auth";

function factories(): { name: string; make: () => Promise<Storage> }[] {
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

const VALID_PNG = "data:image/png;base64," + "i".repeat(100);
const VALID_JPEG = "data:image/jpeg;base64," + "j".repeat(100);
const VALID_WEBP = "data:image/webp;base64," + "w".repeat(100);

describe.each(factories())("$name: avatar perfil", ({ make }) => {
  it("persiste avatarUrl via updateUser", async () => {
    const storage = await make();
    await storage.insertUser(userRow("u1"));
    await storage.updateUser("u1", { avatarUrl: VALID_PNG });
    const row = await storage.getUserById("u1");
    expect(row?.avatarUrl).toBe(VALID_PNG);
  });

  it("remove avatarUrl via null", async () => {
    const storage = await make();
    await storage.insertUser(userRow("u2", VALID_JPEG));
    await storage.updateUser("u2", { avatarUrl: null });
    const row = await storage.getUserById("u2");
    expect(row?.avatarUrl).toBeNull();
  });

  it("propaga avatarUrl em publicUser", async () => {
    const storage = await make();
    await storage.insertUser(userRow("u3", VALID_WEBP));
    const row = await storage.getUserById("u3");
    const pub = row ? publicUser(row) : null;
    expect(pub?.avatarUrl).toBe(VALID_WEBP);
  });

  it("propaga avatarUrl em publicUserWithFunctions", async () => {
    const storage = await make();
    await storage.insertUser(userRow("u4", VALID_PNG));
    const row = await storage.getUserById("u4");
    const pub = row ? await publicUserWithFunctions(storage, row) : null;
    expect(pub?.avatarUrl).toBe(VALID_PNG);
  });

  it("aceita string vazia como remoção no storage (tratado no handler)", async () => {
    // O storage aceita qualquer string; a normalização de '' para null é feita no handler.
    const storage = await make();
    await storage.insertUser(userRow("u5", VALID_PNG));
    await storage.updateUser("u5", { avatarUrl: "" as never });
    const row = await storage.getUserById("u5");
    // Storage guarda vazio como string vazia; o handler converte para null antes de chamar updateUser.
    expect(row?.avatarUrl).toBe("");
  });
});

describe("validação zod avatarUrl", () => {
  const avatarSchema = z
    .union([
      z.literal(""),
      z.literal(null),
      z
        .string()
        .trim()
        .refine((v) => /^data:image\/(png|jpeg|jpg|webp);/.test(v), {
          message: "A imagem deve ser uma data URL de png, jpeg ou webp.",
        })
        .refine((v) => v.length <= 1_500_000, { message: "A imagem excede o limite de 1.5MB." }),
    ])
    .optional();

  it("aceita data URL png válida", () => {
    expect(avatarSchema.parse(VALID_PNG)).toBe(VALID_PNG);
  });

  it("aceita data URL jpeg válida", () => {
    expect(avatarSchema.parse(VALID_JPEG)).toBe(VALID_JPEG);
  });

  it("aceita data URL webp válida", () => {
    expect(avatarSchema.parse(VALID_WEBP)).toBe(VALID_WEBP);
  });

  it("rejeita URL não-data", () => {
    expect(() => avatarSchema.parse("http://example.com/img.png")).toThrow();
  });

  it("rejeita payload maior que 1.5MB", () => {
    const big = "data:image/png;base64," + "x".repeat(1_500_001);
    expect(() => avatarSchema.parse(big)).toThrow();
  });

  it("aceita null", () => {
    expect(avatarSchema.parse(null)).toBeNull();
  });

  it("aceita string vazia", () => {
    expect(avatarSchema.parse("")).toBe("");
  });

  it("aceita undefined", () => {
    expect(avatarSchema.parse(undefined)).toBeUndefined();
  });
});
