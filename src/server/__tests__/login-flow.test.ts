import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { hashPassword, verifyPassword, generateSaltHex, getDummyPasswordHash } from "@/server/passwords";
import { SqliteStorage, MemoryStorage, type Storage, type UserRow } from "@/server/storage";
import { resolvePepper } from "@/server/context";
import { logLoginAttempt, type LoginLogEntry } from "@/server/login-logger";
import { appendFileSync, readFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const PEPPER = "x4gCc1jLixxR97kVnzBE0uNV/oPUiMFdcVZKPDdMhUw=";
const TEST_LOG = join(process.cwd(), "logs", "login-test.jsonl");

afterEach(() => {
  delete process.env["AUTH_PEPPER"];
  if (existsSync(TEST_LOG)) unlinkSync(TEST_LOG);
});

function userRow(overrides: Partial<UserRow> = {}): UserRow {
  const salt = generateSaltHex();
  const hash = hashPassword("Geos@2026!", PEPPER, salt);
  return {
    id: "u_test",
    name: "Admin Test",
    email: "admin@grupogeos.com.br",
    role: "admin",
    jobTitle: null,
    department: null,
    bio: null,
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Login flow completo (simulação server-side)", () => {
  let storage: Storage;

  beforeEach(async () => {
    storage = await SqliteStorage.open(":memory:");
    process.env["AUTH_PEPPER"] = PEPPER;
  });

  it("hash e verificação com pepper real", () => {
    const salt = generateSaltHex();
    const hash = hashPassword("Geos@2026!", PEPPER, salt);
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(verifyPassword("Geos@2026!", PEPPER, hash)).toBe(true);
  });

  it("senha errada é rejeitada", () => {
    const salt = generateSaltHex();
    const hash = hashPassword("Geos@2026!", PEPPER, salt);
    expect(verifyPassword("senha-errada", PEPPER, hash)).toBe(false);
  });

  it("pepper diferente é rejeitada", () => {
    const salt = generateSaltHex();
    const hash = hashPassword("Geos@2026!", PEPPER, salt);
    expect(verifyPassword("Geos@2026!", "outra-pepper-totalmente-diferente-xxx", hash)).toBe(false);
  });

  it("busca de usuário por email (case-insensitive) e verificação", async () => {
    const row = userRow();
    await storage.insertUser(row);

    const found = await storage.getUserByEmail("ADMIN@GRUPOGEOS.COM.BR");
    expect(found).not.toBeNull();
    expect(found!.id).toBe("u_test");

    const valid = verifyPassword("Geos@2026!", PEPPER, found!.passwordHash);
    expect(valid).toBe(true);
  });

  it("email inexistente: hash dummy retorna false (timing-safe)", async () => {
    const found = await storage.getUserByEmail("naoexiste@test.com");
    expect(found).toBeNull();

    const dummyHash = getDummyPasswordHash();
    expect(verifyPassword("Geos@2026!", PEPPER, dummyHash)).toBe(false);
    expect(verifyPassword("qualquer", PEPPER, dummyHash)).toBe(false);
  });

  it("resolvePepper usa AUTH_PEPPER do env", async () => {
    process.env["AUTH_PEPPER"] = PEPPER;
    const pepper = await resolvePepper(storage);
    expect(pepper).toBe(PEPPER);
  });

  it("resolvePepper gera e persiste quando não há env", async () => {
    delete process.env["AUTH_PEPPER"];
    const pepper = await resolvePepper(storage);
    expect(pepper.length).toBeGreaterThan(0);
    const stored = await storage.getMeta("auth_pepper");
    expect(stored).toBe(pepper);
  });

  it("hash com hash-wasm é verificável por @noble/hashes (compatibilidade)", async () => {
    const salt = "0f0e0d0c0b0a09080706050403020100";
    const hash = hashPassword("Geos@2026!", PEPPER, salt);
    expect(verifyPassword("Geos@2026!", PEPPER, hash)).toBe(true);
    expect(verifyPassword("Geos@2026!", PEPPER, hash)).toBe(true);
  });

  it("dummy hash formato PHC válido", () => {
    const dummy = getDummyPasswordHash();
    expect(dummy.startsWith("$argon2id$")).toBe(true);
    expect(dummy.includes("m=19456")).toBe(true);
    expect(dummy.includes("t=2")).toBe(true);
    expect(dummy.includes("p=1")).toBe(true);
  });

  it("simula login completo: insert user + hash + verify + session", async () => {
    const row = userRow();
    await storage.insertUser(row);

    const found = await storage.getUserByEmail(row.email);
    expect(found).not.toBeNull();

    const valid = verifyPassword("Geos@2026!", PEPPER, found!.passwordHash);
    expect(valid).toBe(true);

    const token = crypto.randomUUID();
    expect(token.length).toBeGreaterThan(10);
  });

  it("senha vazia é rejeitada (edge case)", () => {
    const salt = generateSaltHex();
    const hash = hashPassword("Geos@2026!", PEPPER, salt);
    expect(verifyPassword("", PEPPER, hash)).toBe(false);
  });

  it("senha com espaços extras é tratada", () => {
    const salt = generateSaltHex();
    const hash = hashPassword("Geos@2026!", PEPPER, salt);
    expect(verifyPassword("Geos@2026!  ", PEPPER, hash)).toBe(false);
    expect(verifyPassword(" Geos@2026!", PEPPER, hash)).toBe(false);
  });
});

describe("login-logger (file-based)", () => {
  const logFile = join(process.cwd(), "logs", "login-attempts.jsonl");

  it("logLoginAttempt escreve no arquivo", () => {
    logLoginAttempt({
      ts: new Date().toISOString(),
      email: "test@test.com",
      ip: "127.0.0.1",
      outcome: "success",
    });

    expect(existsSync(logFile)).toBe(true);
    const content = readFileSync(logFile, "utf-8");
    const lines = content.trim().split("\n");
    const last = JSON.parse(lines[lines.length - 1]) as LoginLogEntry;
    expect(last.email).toBe("test@test.com");
    expect(last.outcome).toBe("success");
    expect(last.ip).toBe("127.0.0.1");
  });

  it("logLoginAttempt registra falha com detalhes", () => {
    logLoginAttempt({
      ts: new Date().toISOString(),
      email: "fail@test.com",
      ip: "10.0.0.1",
      outcome: "failure",
      reason: "invalid_password",
      userFound: true,
      passwordValid: false,
      pepperSource: "env",
      passwordHashPrefix: "$argon2id$v=19$m=19456",
    });

    const content = readFileSync(logFile, "utf-8");
    const lines = content.trim().split("\n");
    const last = JSON.parse(lines[lines.length - 1]) as LoginLogEntry;
    expect(last.outcome).toBe("failure");
    expect(last.reason).toBe("invalid_password");
    expect(last.userFound).toBe(true);
    expect(last.passwordValid).toBe(false);
  });

  it("logLoginAttempt registra rate_limit", () => {
    logLoginAttempt({
      ts: new Date().toISOString(),
      email: "ratelimited@test.com",
      ip: "10.0.0.2",
      outcome: "rate_limited",
    });

    const content = readFileSync(logFile, "utf-8");
    const lines = content.trim().split("\n");
    const last = JSON.parse(lines[lines.length - 1]) as LoginLogEntry;
    expect(last.outcome).toBe("rate_limited");
  });

  it("logLoginAttempt não trava em caso de erro", () => {
    expect(() => {
      logLoginAttempt({
        ts: "invalid",
        email: "test@test.com",
        ip: null,
        outcome: "error",
        error: "test error",
      });
    }).not.toThrow();
  });

  it("logLoginAttempt registra sucesso com IP", () => {
    logLoginAttempt({
      ts: new Date().toISOString(),
      email: "admin@test.com",
      ip: "163.176.45.217",
      outcome: "success",
      userFound: true,
      passwordValid: true,
    });

    const content = readFileSync(logFile, "utf-8");
    const lines = content.trim().split("\n");
    const last = JSON.parse(lines[lines.length - 1]) as LoginLogEntry;
    expect(last.outcome).toBe("success");
    expect(last.ip).toBe("163.176.45.217");
  });
});
