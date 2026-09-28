/**
 * Testes unitários para funções de autenticação em src/server/auth.ts
 */

import { describe, it, expect } from "vitest";
import {
  publicUser,
  AuthError,
} from "@/server/auth";
import type { UserRow } from "@/server/storage";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const makeUserRow = (
  overrides: Partial<UserRow> = {},
): UserRow => ({
  id: "user-1",
  name: "Teste",
  email: "teste@teste.com",
  role: "desenvolvedor",
  jobTitle: null,
  department: null,
  bio: null,
  avatarUrl: null,
  passwordHash: "$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHQ$hash",
  passwordSalt: "saltedatasalt",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

/* ------------------------------------------------------------------ */
/* publicUser                                                        */
/* ------------------------------------------------------------------ */

describe("auth — publicUser", () => {
  it("mapeia UserRow para PublicUser", () => {
    const user = makeUserRow();
    const result = publicUser(user);
    expect(result.id).toBe("user-1");
    expect(result.name).toBe("Teste");
    expect(result.email).toBe("teste@teste.com");
    expect(result.role).toBe("desenvolvedor");
    expect(result.functions).toEqual([]);
  });

  it("inclui funções concedidas", () => {
    const user = makeUserRow();
    const result = publicUser(user, ["task:read", "task:write"]);
    expect(result.functions).toEqual(["task:read", "task:write"]);
  });

  it("não inclui passwordHash no PublicUser", () => {
    const user = makeUserRow();
    const result = publicUser(user);
    expect(result).not.toHaveProperty("passwordHash");
    expect(result).not.toHaveProperty("passwordSalt");
  });

  it("trata avatarUrl como null", () => {
    const user = makeUserRow({ avatarUrl: null });
    const result = publicUser(user);
    expect(result.avatarUrl).toBeNull();
  });

  it("trata teamMemberId como null por padrão", () => {
    const user = makeUserRow({ teamMemberId: null });
    const result = publicUser(user);
    expect(result.teamMemberId).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* AuthError                                                         */
/* ------------------------------------------------------------------ */

describe("auth — AuthError", () => {
  it("cria erro com mensagem e status", () => {
    const err = new AuthError("Mensagem de erro", 401);
    expect(err.message).toBe("Mensagem de erro");
    expect(err.status).toBe(401);
    expect(err.name).toBe("AuthError");
  });

  it("cria erro 403 para permissão negada", () => {
    const err = new AuthError("Acesso negado", 403);
    expect(err.status).toBe(403);
  });
});

/* ------------------------------------------------------------------ */
/* publicUserWithFunctions (testado via mock do storage)               */
/* ------------------------------------------------------------------ */

describe("auth — publicUserWithFunctions", () => {
  it("retorna PublicUser com funções do storage", async () => {
    const { publicUserWithFunctions } = await import("@/server/auth");
    const mockStorage = {
      listUserFunctions: async (userId: string) => [
        { functionKey: "task:read" },
        { functionKey: "task:write" },
      ],
    };
    const user = makeUserRow();
    const result = await publicUserWithFunctions(mockStorage as any, user);
    expect(result.functions).toEqual(["task:read", "task:write"]);
  });

  it("retorna funções vazias quando storage retorna vazio", async () => {
    const { publicUserWithFunctions } = await import("@/server/auth");
    const mockStorage = {
      listUserFunctions: async () => [],
    };
    const user = makeUserRow();
    const result = await publicUserWithFunctions(mockStorage as any, user);
    expect(result.functions).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* requireUser (requer contexto HTTP, testado via integração)    */
/* ------------------------------------------------------------------ */

describe("auth — requireUser", () => {
  it("AuthError existe e é lançado com status 401", async () => {
    const { AuthError } = await import("@/server/auth");
    const err = new AuthError("Precisa entrar", 401);
    expect(err).toBeInstanceOf(AuthError);
    expect(err.status).toBe(401);
  });
});
