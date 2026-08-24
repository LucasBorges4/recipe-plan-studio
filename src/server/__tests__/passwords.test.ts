import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  generateSaltHex,
  getDummyPasswordHash,
} from "@/server/passwords";

const PEPPER = "pepper-de-teste-32-bytes-aaaaaaaaaaaaaa";

describe("passwords (Argon2id)", () => {
  it("gera salt hexadecimal de 32 caracteres (16 bytes)", () => {
    const salt = generateSaltHex();
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
  });

  it("hash verifica a senha correta com a pepper correta", async () => {
    const salt = generateSaltHex();
    const hash = await hashPassword("SenhaForte123", PEPPER, salt);
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword("SenhaForte123", PEPPER, hash)).toBe(true);
  });

  it("rejeita senha errada", async () => {
    const salt = generateSaltHex();
    const hash = await hashPassword("SenhaForte123", PEPPER, salt);
    expect(await verifyPassword("senha-errada", PEPPER, hash)).toBe(false);
  });

  it("rejeita com pepper errada (keyed hashing)", async () => {
    const salt = generateSaltHex();
    const hash = await hashPassword("SenhaForte123", PEPPER, salt);
    expect(await verifyPassword("SenhaForte123", "outra-pepper-errada-xxxxxxxxxxx", hash)).toBe(
      false,
    );
  });

  it("salts distintos produzem hashes distintos para mesma senha", async () => {
    const a = await hashPassword("igual", PEPPER, generateSaltHex());
    const b = await hashPassword("igual", PEPPER, generateSaltHex());
    expect(a).not.toBe(b);
  });

  it("dummy hash não lança e retorna false", async () => {
    const dummy = getDummyPasswordHash();
    expect(dummy.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword("qualquer", PEPPER, dummy)).toBe(false);
    expect(await verifyPassword("qualquer", "pepper-errada", dummy)).toBe(false);
  });
});
