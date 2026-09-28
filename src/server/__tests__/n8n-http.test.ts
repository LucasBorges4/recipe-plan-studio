import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  listN8nWorkflows,
  getN8nWorkflow,
  createN8nWorkflow,
  updateN8nWorkflow,
  deleteN8nWorkflow,
  n8nApiKey,
  n8nBaseUrl,
  n8nPublicUrl,
} from "@/server/n8n";

/* Mock global fetch para provar paths exatos e headers */
let fetchCalls: Array<{ url: string; init?: RequestInit | undefined }> = [];

beforeEach(() => {
  fetchCalls = [];
  global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url.toString();
    fetchCalls.push({ url: urlStr, init });
    // Mock de resposta padrão baseada na URL
    if (urlStr.includes("/workflows")) {
      const isList = urlStr.endsWith("/workflows") || urlStr.endsWith("/workflows/");
      const isSingle = /\/workflows\/\d+$/.test(urlStr);
      const isPost = init?.method === "POST";
      const isPut = init?.method === "PUT";
      const isDelete = init?.method === "DELETE";
      const isGet = !init?.method || init?.method === "GET";

      // Ordem: métodos específicos primeiro, depois list/get/delete
      if (isPost) {
        return new Response(JSON.stringify({ id: 42, name: "Novo WF", active: true }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (isPut && isSingle) {
        return new Response(JSON.stringify({ id: 42, name: "Atualizado" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (isDelete && isSingle) {
        return new Response(null, { status: 204 });
      }
      if (isGet && isSingle) {
        return new Response(JSON.stringify({ id: 42, name: "Mock WF" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (isList) {
        return new Response(
          JSON.stringify({ data: [{ id: 1, name: "Mock WF" }], nextCursor: null }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }
    return new Response(JSON.stringify({}), { status: 404, statusText: "Not Found" });
  };
});

afterEach(() => {
  // @ts-expect-error restaura fetch original se necessário (não precisa ser perfeito para testes)
  global.fetch = undefined;
});

describe("n8n HTTP — paths corretos e headers", () => {
  it("listN8nWorkflows usa GET /api/v1/workflows", async () => {
    process.env["N8N_API_KEY"] = "test-key-123";
    const result = await listN8nWorkflows();
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(fetchCalls.length).toBe(1);
    const call = fetchCalls[0]!;
    expect(call.url).toContain("/workflows");
    expect(call.url).toMatch(/\/workflows$/);
    const headers = (call.init?.headers as Record<string, string>) ?? {};
    expect(headers["X-N8N-API-KEY"]).toBe("test-key-123");
  });

  it("getN8nWorkflow usa GET /api/v1/workflows/{id}", async () => {
    process.env["N8N_API_KEY"] = "test-key-456";
    const result = await getN8nWorkflow(99);
    expect(result.id).toBe(42);
    expect(fetchCalls.length).toBe(1);
    const call = fetchCalls[0]!;
    expect(call.url).toContain("/workflows/99");
    expect(call.init?.method ?? "GET").toBe("GET");
  });

  it("createN8nWorkflow usa POST /api/v1/workflows", async () => {
    process.env["N8N_API_KEY"] = "test-key-789";
    const result = await createN8nWorkflow({ name: "Novo WF" });
    expect(result.id).toBe(42);
    expect(fetchCalls.length).toBe(1);
    const call = fetchCalls[0]!;
    expect(call.url).toContain("/workflows");
    expect(call.init?.method).toBe("POST");
    const body = JSON.parse(String(call.init?.body ?? "{}"));
    expect(body.name).toBe("Novo WF");
  });

  it("updateN8nWorkflow usa PUT /api/v1/workflows/{id}", async () => {
    process.env["N8N_API_KEY"] = "test-key-abc";
    const result = await updateN8nWorkflow(77, { name: "Atualizado" });
    expect(result.id).toBe(42);
    expect(fetchCalls.length).toBe(1);
    const call = fetchCalls[0]!;
    expect(call.url).toContain("/workflows/77");
    expect(call.init?.method).toBe("PUT");
  });

  it("deleteN8nWorkflow usa DELETE /api/v1/workflows/{id}", async () => {
    process.env["N8N_API_KEY"] = "";
    await deleteN8nWorkflow(55);
    expect(fetchCalls.length).toBe(1);
    const call = fetchCalls[0]!;
    expect(call.url).toContain("/workflows/55");
    expect(call.init?.method).toBe("DELETE");
  });

  it("env N8N_URL altera base URL", () => {
    process.env["N8N_URL"] = "http://192.168.1.100:5679";
    expect(n8nBaseUrl()).toBe("http://192.168.1.100:5679");
    delete process.env["N8N_URL"];
  });

  it("env N8N_PUBLIC_URL altera public URL", () => {
    process.env["N8N_PUBLIC_URL"] = "https://n8n.gwg.com";
    expect(n8nPublicUrl()).toBe("https://n8n.gwg.com");
    delete process.env["N8N_PUBLIC_URL"];
  });
});
