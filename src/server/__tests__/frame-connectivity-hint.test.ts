import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getFrameConnectivityHint } from "@/server/n8n";

describe("getFrameConnectivityHint", () => {
  beforeEach(() => {
    global.fetch = async () => new Response("", { status: 200, headers: {} });
  });

  afterEach(() => {
    global.fetch = undefined as never;
  });

  it("HTTP 200 sem x-frame-options -> reachable:true, blocked:false", async () => {
    global.fetch = async () => new Response("", { status: 200, headers: {} });
    const result = await getFrameConnectivityHint();
    expect(result.reachable).toBe(true);
    expect(result.blocked).toBe(false);
  });

  it("HTTP 200 com x-frame-options: SAMEORIGIN -> reachable:true, blocked:true", async () => {
    global.fetch = async () => new Response("", { status: 200, headers: { "x-frame-options": "SAMEORIGIN" } });
    const result = await getFrameConnectivityHint();
    expect(result.reachable).toBe(true);
    expect(result.blocked).toBe(true);
    expect(result.frameHeader).toBe("SAMEORIGIN");
  });

  it("HTTP 200 com CSP frame-ancestors permissivo -> reachable:true, blocked:false", async () => {
    global.fetch = async () => new Response("", { status: 200, headers: { "content-security-policy": "frame-ancestors 'self' https://portal.163-176-45-217.sslip.io;" } });
    const result = await getFrameConnectivityHint();
    expect(result.reachable).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.cspFrameAncestors).toBe(true);
  });

  it("rede falhou (fetch rejeita) -> reachable:false, blocked:false", async () => {
    global.fetch = async () => {
      throw new Error("Network error");
    };
    const result = await getFrameConnectivityHint();
    expect(result.reachable).toBe(false);
    expect(result.blocked).toBe(false);
  });

  it("timeout/rede falhada não lança", async () => {
    global.fetch = async () => {
      throw new Error("Timeout");
    };
    await expect(getFrameConnectivityHint()).resolves.toBeDefined();
  });
});
