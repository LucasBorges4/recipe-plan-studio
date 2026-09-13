import { describe, it, expect } from "vitest";
import { MemoryStorage } from "@/server/storage";
import { updateUserPassword } from "@/server/passwords-helpers";

describe("updateUserPassword", () => {
  it("atualiza hash e salt do usuário", async () => {
    const storage = new MemoryStorage();
    await storage.insertUser({
      id: "u1",
      name: "Test",
      email: "test@test.com",
      role: "gestor",
      jobTitle: null,
      department: null,
      bio: null,
      passwordHash: "old",
      passwordSalt: "old",
      createdAt: new Date().toISOString(),
    });
    await updateUserPassword(storage, "u1", "newhash", "newsalt");
    const user = await storage.getUserById("u1");
    expect(user?.passwordHash).toBe("newhash");
    expect(user?.passwordSalt).toBe("newsalt");
  });
});
