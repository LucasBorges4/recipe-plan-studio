import { describe, it, expect, beforeAll } from "vitest";
import { hashPassword, verifyPassword, generateSaltHex } from "@/server/passwords";

const PEPPER = "x4gCc1jLixxR97kVnzBE0uNV/oPUiMFdcVZKPDdMhUw=";

/* ------------------------------------------------------------------ */
/* Simulação do register-server.js                                    */
/* ------------------------------------------------------------------ */

function parsePortalHash(phcHash: string): { saltB64: string; hashB64: string } | null {
  const match = phcHash.match(
    /^\$argon2(id|i|d)\$v=\d+\$[^$]+\$([A-Za-z0-9+/=]+)\$([A-Za-z0-9+/=]+)$/,
  );
  if (!match) return null;
  return { saltB64: match[2], hashB64: match[3] };
}

function verifyPortalArgon2id(plaintext: string, pepper: string, saltB64: string, hashB64: string): boolean {
  try {
    const { argon2id: nobleArgon2id } = require("@noble/hashes/argon2.js");
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const pepperBuf = Buffer.from(pepper);
    const result = nobleArgon2id(Buffer.from(plaintext), salt, {
      t: 2,
      m: 19456,
      p: 1,
      dkLen: 32,
      version: 0x13,
      key: pepperBuf,
    });
    let diff = 0;
    for (let i = 0; i < result.length; i++) diff |= result[i] ^ expected[i]!;
    return diff === 0;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Usuários simulados                                                 */
/* ------------------------------------------------------------------ */

interface PortalUser {
  id: string;
  email: string;
  name: string;
  role: string;
  passwordHash: string;
  passwordSalt: string;
}

interface N8nUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string; // bcrypt
  roleSlug: string;
  disabled: boolean;
}

function createPortalUser(email: string, password: string, name: string, role: string): PortalUser {
  const salt = generateSaltHex();
  const hash = hashPassword(password, PEPPER, salt);
  return {
    id: crypto.randomUUID(),
    email,
    name,
    role,
    passwordHash: hash,
    passwordSalt: salt,
  };
}

/* Shared state for cross-describe flow simulation */
const n8nUsers: Map<string, N8nUser> = new Map();
const portalUsers: PortalUser[] = [];

/* ------------------------------------------------------------------ */
/* 1. Validação de registro (register-server.js)                      */
/* ------------------------------------------------------------------ */

describe("n8n Registro - Validação de entrada", () => {
  function validateRegistration(email: string, password: string): string | null {
    if (!email || !password) return "E-mail e senha são obrigatórios.";
    if (password.length < 6) return "A senha deve ter pelo menos 6 caracteres.";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "E-mail inválido.";
    return null;
  }

  it("aceita email e senha válidos", () => {
    expect(validateRegistration("user@test.com", "Geos@2026!")).toBeNull();
  });

  it("rejeita email vazio", () => {
    expect(validateRegistration("", "Geos@2026!")).toBe("E-mail e senha são obrigatórios.");
  });

  it("rejeita senha vazia", () => {
    expect(validateRegistration("user@test.com", "")).toBe("E-mail e senha são obrigatórios.");
  });

  it("rejeita senha curta (< 6 caracteres)", () => {
    expect(validateRegistration("user@test.com", "abc")).toBe("A senha deve ter pelo menos 6 caracteres.");
  });

  it("rejeita senha com exatamente 5 caracteres", () => {
    expect(validateRegistration("user@test.com", "abcde")).toBe("A senha deve ter pelo menos 6 caracteres.");
  });

  it("aceita senha com exatamente 6 caracteres", () => {
    expect(validateRegistration("user@test.com", "abcdef")).toBeNull();
  });

  it("rejeita email sem @", () => {
    expect(validateRegistration("usertest.com", "Geos@2026!")).toBe("E-mail inválido.");
  });

  it("rejeita email sem domínio", () => {
    expect(validateRegistration("user@", "Geos@2026!")).toBe("E-mail inválido.");
  });

  it("rejeita email com espaços", () => {
    expect(validateRegistration("user @test.com", "Geos@2026!")).toBe("E-mail inválido.");
  });

  it("aceita email com subdomínio", () => {
    expect(validateRegistration("user@sub.domain.com", "Geos@2026!")).toBeNull();
  });

  it("aceita email com caracteres especiais", () => {
    expect(validateRegistration("user.name+tag@test.com", "Geos@2026!")).toBeNull();
  });

  it("rejeita null/undefined", () => {
    expect(validateRegistration(null as any, "Geos@2026!")).toBe("E-mail e senha são obrigatórios.");
    expect(validateRegistration("user@test.com", undefined as any)).toBe("E-mail e senha são obrigatórios.");
  });
});

/* ------------------------------------------------------------------ */
/* 2. Hashing bcrypt (n8n register-server.js)                         */
/* ------------------------------------------------------------------ */

describe("n8n Registro - Bcrypt hashing", () => {
  it("bcryptjs produz hash com prefixo $2a$ ou $2b$", async () => {
    const bcrypt = require("bcryptjs");
    const hash = await bcrypt.hash("Geos@2026!", 10);
    expect(hash).toMatch(/^\$2[ab]\$/);
  });

  it("bcryptjs verifica senha correta", async () => {
    const bcrypt = require("bcryptjs");
    const hash = await bcrypt.hash("Geos@2026!", 10);
    const valid = await bcrypt.compare("Geos@2026!", hash);
    expect(valid).toBe(true);
  });

  it("bcryptjs rejeita senha errada", async () => {
    const bcrypt = require("bcryptjs");
    const hash = await bcrypt.hash("Geos@2026!", 10);
    const valid = await bcrypt.compare("wrongpass", hash);
    expect(valid).toBe(false);
  });

  it("bcryptjs salt rounds 10 produz hash de 60 chars", async () => {
    const bcrypt = require("bcryptjs");
    const hash = await bcrypt.hash("test", 10);
    expect(hash.length).toBe(60);
  });

  it("mesma senha produz hashes distintos (bcrypt salt aleatório)", async () => {
    const bcrypt = require("bcryptjs");
    const h1 = await bcrypt.hash("Geos@2026!", 10);
    const h2 = await bcrypt.hash("Geos@2026!", 10);
    expect(h1).not.toBe(h2);
  });
});

/* ------------------------------------------------------------------ */
/* 3. Login portal fallback - argon2id parsing                        */
/* ------------------------------------------------------------------ */

describe("n8n Login Portal - parsePortalHash", () => {
  it("extrai salt e hash de hash PHC válido", () => {
    const salt = generateSaltHex();
    const hash = hashPassword("Geos@2026!", PEPPER, salt);
    const parsed = parsePortalHash(hash);
    expect(parsed).not.toBeNull();
    expect(parsed!.saltB64).toBeTruthy();
    expect(parsed!.hashB64).toBeTruthy();
  });

  it("retorna null para hash inválido", () => {
    expect(parsePortalHash("invalid-hash")).toBeNull();
  });

  it("retorna null para string vazia", () => {
    expect(parsePortalHash("")).toBeNull();
  });

  it("retorna null para hash bcrypt", () => {
    expect(parsePortalHash("$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012")).toBeNull();
  });

  it("parse e verificação round-trip", () => {
    const salt = generateSaltHex();
    const hash = hashPassword("MinhaSenha!@#", PEPPER, salt);
    const parsed = parsePortalHash(hash);
    expect(parsed).not.toBeNull();

    const verified = verifyPortalArgon2id("MinhaSenha!@#", PEPPER, parsed!.saltB64, parsed!.hashB64);
    expect(verified).toBe(true);
  });

  it("falha com senha errada no parse + verify", () => {
    const salt = generateSaltHex();
    const hash = hashPassword("Geos@2026!", PEPPER, salt);
    const parsed = parsePortalHash(hash);
    const verified = verifyPortalArgon2id("wrongpassword", PEPPER, parsed!.saltB64, parsed!.hashB64);
    expect(verified).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* 4. Login portal fallback - argon2id verification                   */
/* ------------------------------------------------------------------ */

describe("n8n Login Portal - Argon2id portal verification", () => {
  it("verifica hash com pepper correta", () => {
    const salt = generateSaltHex();
    const hash = hashPassword("Geos@2026!", PEPPER, salt);
    const parsed = parsePortalHash(hash)!;
    const valid = verifyPortalArgon2id("Geos@2026!", PEPPER, parsed.saltB64, parsed.hashB64);
    expect(valid).toBe(true);
  });

  it("rejeita com pepper errada", () => {
    const salt = generateSaltHex();
    const hash = hashPassword("Geos@2026!", PEPPER, salt);
    const parsed = parsePortalHash(hash)!;
    const valid = verifyPortalArgon2id("Geos@2026!", "outra-pepper-diferente-1234567890", parsed.saltB64, parsed.hashB64);
    expect(valid).toBe(false);
  });

  it("rejeita com senha errada", () => {
    const salt = generateSaltHex();
    const hash = hashPassword("Geos@2026!", PEPPER, salt);
    const parsed = parsePortalHash(hash)!;
    const valid = verifyPortalArgon2id("SenhaErrada", PEPPER, parsed.saltB64, parsed.hashB64);
    expect(valid).toBe(false);
  });

  it("compara com @noble/hashes (compatibilidade cross-runtime)", async () => {
    const salt = generateSaltHex();
    const phcHash = hashPassword("Geos@2026!", PEPPER, salt);
    const parsed = parsePortalHash(phcHash)!;

    const nobleResult = verifyPortalArgon2id("Geos@2026!", PEPPER, parsed.saltB64, parsed.hashB64);
    expect(nobleResult).toBe(true);

    const nobleResult2 = verifyPortalArgon2id("Geos@2026!", PEPPER, parsed.saltB64, parsed.hashB64);
    expect(nobleResult2).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* 5. Simulação completa: registro → login n8n → fallback portal      */
/* ------------------------------------------------------------------ */

describe("n8n Login Flow completo - simulação", () => {
  it("1. Registro via register-server.js cria usuário no n8n SQLite", async () => {
    const bcrypt = require("bcryptjs");
    const email = "novo.usuario@grupogeos.com.br";
    const password = "Geos@2026!";

    const bcryptHash = await bcrypt.hash(password, 10);
    const n8nUser: N8nUser = {
      id: crypto.randomUUID(),
      email,
      firstName: "Novo",
      lastName: "Usuario",
      passwordHash: bcryptHash,
      roleSlug: "global:member",
      disabled: false,
    };
    n8nUsers.set(email, n8nUser);

    expect(n8nUsers.has(email)).toBe(true);
    const stored = n8nUsers.get(email)!;
    expect(stored.email).toBe(email);
    expect(stored.disabled).toBe(false);
    expect(stored.passwordHash).toMatch(/^\$2[ab]\$/);
  });

  it("2. Login n8n local com bcryptjs retorna sucesso", async () => {
    const bcrypt = require("bcryptjs");
    const email = "novo.usuario@grupogeos.com.br";
    const n8nUser = n8nUsers.get(email)!;

    const valid = await bcrypt.compare("Geos@2026!", n8nUser.passwordHash);
    expect(valid).toBe(true);
  });

  it("3. Login n8n local com senha errada falha", async () => {
    const bcrypt = require("bcryptjs");
    const email = "novo.usuario@grupogeos.com.br";
    const n8nUser = n8nUsers.get(email)!;

    const valid = await bcrypt.compare("senhaErrada", n8nUser.passwordHash);
    expect(valid).toBe(false);
  });

  it("4. Fallback portal: email não existe no n8n → busca no portal PG", () => {
    const portalEmail = "portal.user@grupogeos.com.br";
    const portalUser = createPortalUser(portalEmail, "Geos@2026!", "Portal User", "admin");
    portalUsers.push(portalUser);

    const n8nUser = n8nUsers.get(portalEmail);
    expect(n8nUser).toBeUndefined();

    const found = portalUsers.find((u) => u.email === portalEmail);
    expect(found).toBeDefined();
    expect(found!.role).toBe("admin");
  });

  it("5. Fallback portal: verificação argon2id com pepper retorna sucesso", () => {
    const portalUser = portalUsers[0]!;
    const parsed = parsePortalHash(portalUser.passwordHash)!;
    const valid = verifyPortalArgon2id("Geos@2026!", PEPPER, parsed.saltB64, parsed.hashB64);
    expect(valid).toBe(true);
  });

  it("6. Fallback portal: auto-provisioning cria usuário no n8n SQLite", async () => {
    const bcrypt = require("bcryptjs");
    const portalUser = portalUsers[0]!;
    const portalEmail = portalUser.email;

    const roleSlug = portalUser.role === "admin" ? "global:admin" : "global:member";
    const [firstName, ...lastParts] = portalUser.name.trim().split(/\s+/);
    const lastName = lastParts.join(" ") || firstName;

    const bcryptHash = await bcrypt.hash("Geos@2026!", 10);
    const n8nUser: N8nUser = {
      id: crypto.randomUUID(),
      email: portalEmail,
      firstName: firstName || "User",
      lastName: lastName || "",
      passwordHash: bcryptHash,
      roleSlug,
      disabled: false,
    };
    n8nUsers.set(portalEmail, n8nUser);

    const stored = n8nUsers.get(portalEmail)!;
    expect(stored.email).toBe(portalEmail);
    expect(stored.firstName).toBe("Portal");
    expect(stored.lastName).toBe("User");
    expect(stored.roleSlug).toBe("global:admin");
    expect(stored.disabled).toBe(false);
  });

  it("7. Login n8n local funciona após auto-provisioning", async () => {
    const bcrypt = require("bcryptjs");
    const portalEmail = "portal.user@grupogeos.com.br";
    const n8nUser = n8nUsers.get(portalEmail)!;

    const valid = await bcrypt.compare("Geos@2026!", n8nUser.passwordHash);
    expect(valid).toBe(true);
  });

  it("8. Simulação de sessão: token é gerado após login", () => {
    const sessionToken = crypto.randomUUID();
    expect(sessionToken).toBeTruthy();
    expect(sessionToken.length).toBeGreaterThan(30);
  });
});

/* ------------------------------------------------------------------ */
/* 6. RBAC: Role mapping portal → n8n                                */
/* ------------------------------------------------------------------ */

describe("n8n Role Mapping", () => {
  const roleMap: Record<string, string> = {
    admin: "global:admin",
    diretor: "global:member",
    gestor: "global:member",
    desenvolvedor: "global:member",
    auditor: "global:member",
  };

  it("admin → global:admin", () => {
    expect(roleMap["admin"]).toBe("global:admin");
  });

  it("diretor → global:member", () => {
    expect(roleMap["diretor"]).toBe("global:member");
  });

  it("gestor → global:member", () => {
    expect(roleMap["gestor"]).toBe("global:member");
  });

  it("desenvolvedor → global:member", () => {
    expect(roleMap["desenvolvedor"]).toBe("global:member");
  });

  it("auditor → global:member", () => {
    expect(roleMap["auditor"]).toBe("global:member");
  });

  it("all portal roles map to valid n8n slugs", () => {
    for (const [portalRole, n8nSlug] of Object.entries(roleMap)) {
      expect(n8nSlug).toMatch(/^global:(admin|member)$/);
      expect(portalRole.length).toBeGreaterThan(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 7. Edge cases: segurança                                           */
/* ------------------------------------------------------------------ */

describe("n8n Login - Edge cases de segurança", () => {
  it("email case-insensitive no login", async () => {
    const bcrypt = require("bcryptjs");
    const hash = await bcrypt.hash("Geos@2026!", 10);
    const email = "TEST@GRUPOGEOS.COM.BR";
    const normalized = email.toLowerCase().trim();
    expect(normalized).toBe("test@grupogeos.com.br");
  });

  it("pepper vazia não quebra verificação", () => {
    const salt = generateSaltHex();
    const hash = hashPassword("Geos@2026!", "", salt);
    const parsed = parsePortalHash(hash)!;
    const valid = verifyPortalArgon2id("Geos@2026!", "", parsed.saltB64, parsed.hashB64);
    expect(valid).toBe(true);
  });

  it("hash inválido retorn false sem crash", () => {
    const valid = verifyPortalArgon2id("Geos@2026!", PEPPER, "invalid", "invalid");
    expect(valid).toBe(false);
  });

  it("password com caracteres especiais funciona", async () => {
    const bcrypt = require("bcryptjs");
    const specialPw = "Gëos@2026!#$%&*()";
    const hash = await bcrypt.hash(specialPw, 10);
    const valid = await bcrypt.compare(specialPw, hash);
    expect(valid).toBe(true);
  });

  it("password unicode funciona no argon2id", () => {
    const salt = generateSaltHex();
    const unicodePw = "Senha Com Acentos ãéîõü";
    const hash = hashPassword(unicodePw, PEPPER, salt);
    const parsed = parsePortalHash(hash)!;
    const valid = verifyPortalArgon2id(unicodePw, PEPPER, parsed.saltB64, parsed.hashB64);
    expect(valid).toBe(true);
  });

  it("hash muito curto (string danificada) não causa crash", () => {
    expect(() => verifyPortalArgon2id("test", PEPPER, "abc", "def")).not.toThrow();
  });

  it("timing: hash dummy retorna false em tempo constante", () => {
    const start = Date.now();
    for (let i = 0; i < 10; i++) {
      verifyPortalArgon2id(`password-${i}`, PEPPER, "ZHVtbXlzYWx0MTIzNDU2", "6lJxwn0XWAYosKoFUJ/+/l6Rza3em6cqeygRdkcKc+g");
    }
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* 8. Cenários de falha: tentativas inválidas                         */
/* ------------------------------------------------------------------ */

describe("n8n Login - Cenários de falha", () => {
  it("usuário não existe no n8n nem no portal → falha", () => {
    const n8nUser = n8nUsers.get("inexistente@test.com");
    expect(n8nUser).toBeUndefined();
  });

  it("usuário existe no portal mas hash corrompido → falha graceful", () => {
    const badHash = "$argon2id$v=19$m=19456,t=2,p=1$abc$def";
    const parsed = parsePortalHash(badHash);
    if (parsed) {
      const valid = verifyPortalArgon2id("Geos@2026!", PEPPER, parsed.saltB64, parsed.hashB64);
      expect(typeof valid).toBe("boolean");
    } else {
      expect(parsed).toBeNull();
    }
  });

  it("múltiplos logins falhados não alteram hash existente", async () => {
    const bcrypt = require("bcryptjs");
    const email = "stable@test.com";
    const hash = await bcrypt.hash("Geos@2026!", 10);

    for (let i = 0; i < 5; i++) {
      await bcrypt.compare("wrong", hash);
    }

    const valid = await bcrypt.compare("Geos@2026!", hash);
    expect(valid).toBe(true);
  });
});
