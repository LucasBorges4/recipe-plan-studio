import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { provisionN8nUser, n8nBaseUrl, generateSsoToken, verifySsoToken } from "@/server/n8n";

/* Mock direto para o endpoint de registro custom (porta 3456) */
let registerCalls: Array<{ url: string; body?: unknown }> = [];

beforeEach(() => {
  registerCalls = [];
  global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url.toString();
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    registerCalls.push({ url: urlStr, body });
    if (urlStr.includes(":3456/register")) {
      return new Response(
        JSON.stringify({
          ok: true,
          message: "Conta criada com sucesso!",
          id: "fake-uuid-3456",
          email: body?.email,
          firstName: body?.firstName,
          lastName: body?.lastName,
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    }
    if (urlStr.includes(":5679/api/v1/users")) {
      return new Response(JSON.stringify({ message: "Endpoint antigo não deve ser usado" }), {
        status: 404,
      });
    }
    return new Response(JSON.stringify({}), { status: 404 });
  };
});

afterEach(() => {
  global.fetch = undefined as never;
  registerCalls = [];
});

describe("provisionN8nUser", () => {
  it("envia para /register na porta 3456 com email, firstName, lastName e senha quando fornecida", async () => {
    const result = await provisionN8nUser("teste@gwg.com.br", "Ana Silva", "Temp12345!");
    expect(registerCalls.length).toBe(1);
    const call = registerCalls[0]!;
    expect(call.url).toContain("3456");
    expect(call.url).toContain("/register");
    expect(call.body).toMatchObject({
      email: "teste@gwg.com.br",
      password: "Temp12345!",
      firstName: "Ana",
      lastName: "Silva",
    });
  });

  it("funciona sem senha (opcional) enviando apenas email/nome", async () => {
    const result = await provisionN8nUser("teste2@gwg.com.br", "João Pedro da Silva");
    expect(registerCalls.length).toBe(1);
    const body = registerCalls[0]!.body as Record<string, unknown>;
    expect(body["email"]).toBe("teste2@gwg.com.br");
    expect(body["password"]).toBeUndefined();
    expect(body["firstName"]).toBe("João");
  });

  it("envia ssoToken quando fornecido", async () => {
    const token = generateSsoToken({ email: "sso@test.com", firstName: "SSO", lastName: "User" }, "test-secret");
    const result = await provisionN8nUser("sso@test.com", "SSO User", undefined, token);
    expect(registerCalls.length).toBe(1);
    const body = registerCalls[0]!.body as Record<string, unknown>;
    expect(body["email"]).toBe("sso@test.com");
    expect(body["ssoToken"]).toBe(token);
  });

  it("divide nome corretamente para firstName/lastName", async () => {
    await provisionN8nUser("joao@teste.com", "João Pedro da Silva", "Temp12345!");
    const body = registerCalls[0]!.body as Record<string, unknown>;
    expect(body["firstName"]).toBe("João");
    expect(body["lastName"]).toBe("Pedro da Silva");
  });

  it("usa nome completo como firstName quando não há sobrenome", async () => {
    await provisionN8nUser("maria@test.com", "Maria", "Temp12345!");
    const body = registerCalls[0]!.body as Record<string, unknown>;
    expect(body["firstName"]).toBe("Maria");
    expect(body["lastName"]).toBe("Maria");
  });

  it("retorna dados do usuário criado no mock", async () => {
    const result = await provisionN8nUser("user@gwg.com", "User Teste", "Temp12345!");
    expect(result.email).toBe("user@gwg.com");
    expect(result.firstName).toBe("User");
    expect(result.lastName).toBe("Teste");
  });

  it("falha quando o endpoint retorna 404 (simulando sem container)", async () => {
    global.fetch = async () =>
      new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    await expect(provisionN8nUser("fail@test.com", "Fail User", "Temp12345!")).rejects.toThrow();
  });
});

describe("SSO Token", () => {
  it("gera e valida token com secret", () => {
    const token = generateSsoToken({ email: "a@b.com", firstName: "A", lastName: "B" }, "test-secret");
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(2);
    const payload = verifySsoToken(token, "test-secret");
    expect(payload).not.toBeNull();
    expect(payload!.email).toBe("a@b.com");
    expect(payload!.fn).toBe("A");
  });

  it("rejeita token com secret errada", () => {
    const token = generateSsoToken({ email: "a@b.com" }, "secret-a");
    expect(verifySsoToken(token, "secret-b")).toBeNull();
  });

  it("rejeita token expirado", () => {
    // Simula token expirado criando payload manualmente com exp no passado
    const payloadStr = Buffer.from(
      JSON.stringify({ email: "a@b.com", fn: "", ln: "", iat: 0, exp: 1 }),
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    const { createHmac } = require("crypto");
    const hmac = createHmac("sha256", "test-secret").update(payloadStr).digest("base64url");
    const token = `${payloadStr}.${hmac}`;
    expect(verifySsoToken(token, "test-secret")).toBeNull();
  });
});
