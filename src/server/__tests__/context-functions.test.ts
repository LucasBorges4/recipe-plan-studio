/**
 * Testes unitários para funções de context em src/server/context.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  newId,
  isRateLimited,
  registerFailure,
  clearFailures,
} from "@/server/context";

/* ------------------------------------------------------------------ */
/* newId                                                             */
/* ------------------------------------------------------------------ */

describe("context — newId", () => {
  it("gera IDs com prefixo", () => {
    const id = newId("usr");
    expect(id.startsWith("usr_")).toBe(true);
  });

  it("gera IDs únicos", () => {
    const ids = new Set(Array.from({ length: 100 }, () => newId("test")));
    expect(ids.size).toBe(100);
  });

  it("contém parte alfanumérica após underscore", () => {
    const id = newId("aud");
    const parts = id.split("_");
    expect(parts.length).toBe(2);
    expect(parts[1]!.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* Rate limiting                                                       */
/* ------------------------------------------------------------------ */

describe("context — rate limiting", () => {
  beforeEach(() => {
    clearFailures("test-rate-limit");
  });

  it("não é rate limitado no início", () => {
    expect(isRateLimited("test-rate-limit")).toBe(false);
  });

  it("registra falhas e atinge limite", () => {
    // MAX_ATTEMPTS = 8, então precisamos de 8+ registros
    for (let i = 0; i < 9; i++) {
      registerFailure("test-rate-limit");
    }
    expect(isRateLimited("test-rate-limit")).toBe(true);
  });

  it("não atinge limite com poucas falhas", () => {
    for (let i = 0; i < 3; i++) {
      registerFailure("test-rate-limit");
    }
    expect(isRateLimited("test-rate-limit")).toBe(false);
  });

  it("clearFailures reseta o contador", () => {
    for (let i = 0; i < 9; i++) {
      registerFailure("test-rate-limit-clear");
    }
    expect(isRateLimited("test-rate-limit-clear")).toBe(true);
    clearFailures("test-rate-limit-clear");
    expect(isRateLimited("test-rate-limit-clear")).toBe(false);
  });

  it("chaves diferentes são independentes", () => {
    registerFailure("key-a");
    registerFailure("key-a");
    registerFailure("key-b");
    expect(isRateLimited("key-a")).toBe(false); // 2 < 8
    expect(isRateLimited("key-b")).toBe(false); // 1 < 8
    // Preenche key-a
    for (let i = 0; i < 7; i++) registerFailure("key-a");
    expect(isRateLimited("key-a")).toBe(true); // 9 >= 8
    expect(isRateLimited("key-b")).toBe(false); // 1 < 8
  });
});

/* ------------------------------------------------------------------ */
/* resolvePepper                                                       */
/* ------------------------------------------------------------------ */

describe("context — resolvePepper", () => {
  it("retorna string não vazia quando chamada com storage mock", async () => {
    const { resolvePepper } = await import("@/server/context");
    const mockStorage = {
      getMeta: async (key: string) => (key === "auth_pepper" ? "test-pepper" : null),
      insertMeta: async () => {},
    };
    const result = await resolvePepper(mockStorage as any);
    expect(result).toBe("test-pepper");
  });
});
