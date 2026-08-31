import { describe, it, expect } from "vitest";
import { argon2id, argon2Verify } from "hash-wasm";
import {
  hashPassword,
  verifyPassword,
  generateSaltHex,
  getDummyPasswordHash,
} from "@/server/passwords";

const PEPPER = "pepper-de-teste-32-bytes-aaaaaaaaaaaaaa";
const enc = new TextEncoder();

describe("passwords (Argon2id)", () => {
  it("gera salt hexadecimal de 32 caracteres (16 bytes)", () => {
    const salt = generateSaltHex();
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
  });

  it("hash verifica a senha correta com a pepper correta", () => {
    const salt = generateSaltHex();
    const hash = hashPassword("SenhaForte123", PEPPER, salt);
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(verifyPassword("SenhaForte123", PEPPER, hash)).toBe(true);
  });

  it("rejeita senha errada", () => {
    const salt = generateSaltHex();
    const hash = hashPassword("SenhaForte123", PEPPER, salt);
    expect(verifyPassword("senha-errada", PEPPER, hash)).toBe(false);
  });

  it("rejeita com pepper errada (keyed hashing)", () => {
    const salt = generateSaltHex();
    const hash = hashPassword("SenhaForte123", PEPPER, salt);
    expect(verifyPassword("SenhaForte123", "outra-pepper-errada-xxxxxxxxxxx", hash)).toBe(false);
  });

  it("salts distintos produzem hashes distintos para mesma senha", () => {
    const a = hashPassword("igual", PEPPER, generateSaltHex());
    const b = hashPassword("igual", PEPPER, generateSaltHex());
    expect(a).not.toBe(b);
  });

  it("dummy hash não lança e retorna false", () => {
    const dummy = getDummyPasswordHash();
    expect(dummy.startsWith("$argon2id$")).toBe(true);
    expect(verifyPassword("qualquer", PEPPER, dummy)).toBe(false);
    expect(verifyPassword("qualquer", "pepper-errada", dummy)).toBe(false);
  });

  it("é compatível com o formato PHC do hash-wasm (hashes existentes)", async () => {
    const salt = "0f0e0d0c0b0a09080706050403020100";

    // Hash produzido pelo hash-wasm (implementação anterior) deve ser verificado
    // pela nova implementação e vice-versa.
    const hwPhc = await argon2id({
      password: enc.encode("SenhaForte123"),
      salt: enc.encode(salt),
      secret: enc.encode(PEPPER),
      outputType: "encoded",
      iterations: 2,
      parallelism: 1,
      memorySize: 19456,
      hashLength: 32,
    });

    const newPhc = hashPassword("SenhaForte123", PEPPER, salt);
    expect(newPhc).toBe(hwPhc); // mesmo formato PHC

    expect(verifyPassword("SenhaForte123", PEPPER, hwPhc)).toBe(true);
    expect(
      await argon2Verify({
        password: enc.encode("SenhaForte123"),
        hash: newPhc,
        secret: enc.encode(PEPPER),
      }),
    ).toBe(true);
  });
});
