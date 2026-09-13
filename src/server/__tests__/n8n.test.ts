import { describe, it, expect } from "vitest";
import { isBlockedIp, validateN8nUrl, safeFetch } from "@/server/n8n";

/* RED: testes que falham antes das funções de segurança serem implementadas */

describe("n8n hardening - isBlockedIp", () => {
  it("deve rejeitar 10.0.0.0/8", () => {
    expect(isBlockedIp("10.0.0.1")).toBe(true);
  });
  it("deve rejeitar 172.16.0.0/12", () => {
    expect(isBlockedIp("172.16.0.1")).toBe(true);
  });
  it("deve rejeitar 192.168.0.0/16", () => {
    expect(isBlockedIp("192.168.1.1")).toBe(true);
  });
  it("deve rejeitar 169.254.0.0/16", () => {
    expect(isBlockedIp("169.254.1.1")).toBe(true);
  });
  it("deve rejeitar 100.64.0.0/10", () => {
    expect(isBlockedIp("100.64.0.1")).toBe(true);
  });
  it("deve permitir 127.0.0.1", () => {
    expect(isBlockedIp("127.0.0.1")).toBe(false);
  });
  it("deve permitir ::1", () => {
    expect(isBlockedIp("::1")).toBe(false);
  });
  it("deve rejeitar meta-IP", () => {
    expect(isBlockedIp("0.0.0.0")).toBe(true);
  });
});

describe("n8n hardening - validateN8nUrl", () => {
  it("aceita http://127.0.0.1:5679", async () => {
    const validated = await validateN8nUrl("http://127.0.0.1:5679");
    expect(validated).toBeTruthy();
  });
  it("rejeita credenciais na URL", async () => {
    await expect(validateN8nUrl("http://user:pass@host")).rejects.toThrow();
  });
  it("rejeita porta 0", async () => {
    await expect(validateN8nUrl("http://localhost:0")).rejects.toThrow();
  });
  it("rejeita URL com IP bloqueado", async () => {
    await expect(validateN8nUrl("http://10.0.0.1:5679")).rejects.toThrow();
  });
});

describe("n8n hardening - safeFetch", () => {
  it("existe e aceita url", async () => {
    expect(typeof safeFetch).toBe("function");
  });
});
