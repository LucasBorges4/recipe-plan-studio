import { describe, it, expect } from "vitest";
import { publicUser } from "@/server/auth";
import type { UserRow } from "@/server/storage";

describe("publicUser mapeia perfil estendido", () => {
  it("inclui department/bio", () => {
    const row: UserRow = {
      id: "u1",
      name: "Ana",
      email: "ana@x.com",
      role: "gestor",
      jobTitle: "Gestora",
      department: "Operações",
      bio: "Bio aqui",
      passwordHash: "h",
      passwordSalt: "s",
      createdAt: new Date().toISOString(),
    };
    const pub = publicUser(row);
    expect(pub.department).toBe("Operações");
    expect(pub.bio).toBe("Bio aqui");
    expect(pub.jobTitle).toBe("Gestora");
    expect((pub as unknown as Record<string, unknown>)["passwordHash"]).toBeUndefined();
  });
  it("tolera nulos", () => {
    const row: UserRow = {
      id: "u2",
      name: "B",
      email: "b@x.com",
      role: "admin",
      jobTitle: null,
      department: null,
      bio: null,
      passwordHash: "h",
      passwordSalt: "s",
      createdAt: new Date().toISOString(),
    };
    const pub = publicUser(row);
    expect(pub.jobTitle).toBeNull();
    expect(pub.department).toBeNull();
  });
});
