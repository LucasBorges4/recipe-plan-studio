import { describe, it, expect, afterEach } from "vitest";
import { MemoryStorage } from "@/server/storage";
import { resolvePepper, newId } from "@/server/context";

afterEach(() => {
  delete process.env["AUTH_PEPPER"];
});

describe("resolvePepper", () => {
  it("prioriza AUTH_PEPPER do ambiente", async () => {
    process.env["AUTH_PEPPER"] = "pepper-do-env-32-bytes-aaaaaaaaaaaa";
    const storage = new MemoryStorage();
    const pepper = await resolvePepper(storage);
    expect(pepper).toBe("pepper-do-env-32-bytes-aaaaaaaaaaaa");
    // não persiste na meta quando vem do ambiente
    expect(await storage.getMeta("auth_pepper")).toBeNull();
  });

  it("gera e persiste a pepper na meta quando não há env", async () => {
    const storage = new MemoryStorage();
    const first = await resolvePepper(storage);
    expect(first.length).toBeGreaterThan(0);
    const stored = await storage.getMeta("auth_pepper");
    expect(stored).toBe(first);
    // chamadas seguintes retornam o mesmo valor persistido
    const second = await resolvePepper(storage);
    expect(second).toBe(first);
  });
});

describe("newId", () => {
  it("gera identificadores únicos com prefixo", () => {
    const a = newId("u");
    const b = newId("u");
    expect(a.startsWith("u_")).toBe(true);
    expect(b.startsWith("u_")).toBe(true);
    expect(a).not.toBe(b);
  });
});
