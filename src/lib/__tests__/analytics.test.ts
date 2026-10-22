import { describe, it, expect } from "vitest";
import {
  ANALYTICS_EVENT_TYPES,
  deviceFromViewport,
  maskLabel,
  normalizeAnalyticsBatch,
  normalizeAnalyticsEvent,
  sanitizeProps,
} from "@/lib/analytics";

function validEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_123",
    type: "page_view",
    ts: new Date().toISOString(),
    path: "/tarefas",
    sessionId: "s_abc",
    anonId: "a_abc",
    ...overrides,
  };
}

describe("maskLabel", () => {
  it("mascara e-mail", () => {
    expect(maskLabel("Falar com joao.silva@gwg.com")).toBe("Falar com [email]");
  });

  it("mascara CPF", () => {
    expect(maskLabel("CPF 123.456.789-01")).toBe("CPF [cpf]");
  });

  it("mascara sequências numéricas longas", () => {
    expect(maskLabel("Pedido 987654")).toBe("Pedido [num]");
  });

  it("remove caracteres de controle e normaliza espaços", () => {
    expect(maskLabel("  Olá\u0000\n\tmundo  ")).toBe("Olá mundo");
  });

  it("limita o tamanho", () => {
    expect(maskLabel("a".repeat(500)).length).toBe(120);
  });
});

describe("sanitizeProps", () => {
  it("descarta propriedades sensíveis", () => {
    const props = sanitizeProps({
      password: "segredo",
      token: "abc",
      email: "a@b.com",
      cpf: "123",
      card_number: "4111",
      authorization: "Bearer x",
      safe: "ok",
    });
    expect(props).toEqual({ safe: "ok" });
  });

  it("aceita apenas escalares", () => {
    const props = sanitizeProps({
      count: 3,
      active: true,
      label: "texto",
      nested: { a: 1 },
      list: [1, 2],
      nan: Number.NaN,
    });
    expect(props).toEqual({ count: 3, active: true, label: "texto" });
  });

  it("respeita o limite de chaves", () => {
    const input = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, i]));
    expect(Object.keys(sanitizeProps(input)).length).toBe(20);
  });
});

describe("normalizeAnalyticsEvent", () => {
  it("aceita evento válido de todos os tipos permitidos", () => {
    for (const type of ANALYTICS_EVENT_TYPES) {
      expect(normalizeAnalyticsEvent(validEvent({ type }))?.type).toBe(type);
    }
  });

  it("rejeita tipo fora da allowlist", () => {
    expect(normalizeAnalyticsEvent(validEvent({ type: "keylogger" }))).toBeNull();
  });

  it("rejeita evento sem id, sessão ou data", () => {
    expect(normalizeAnalyticsEvent(validEvent({ id: "" }))).toBeNull();
    expect(normalizeAnalyticsEvent(validEvent({ sessionId: "" }))).toBeNull();
    expect(normalizeAnalyticsEvent(validEvent({ ts: "ontem" }))).toBeNull();
  });

  it("neutraliza caminhos perigosos", () => {
    expect(normalizeAnalyticsEvent(validEvent({ path: "javascript:alert(1)" }))?.path).toBe("/");
    expect(normalizeAnalyticsEvent(validEvent({ path: "https://x.test/a?b=1" }))?.path).toBe(
      "/a?b=1",
    );
  });

  it("limita duração e scroll", () => {
    const event = normalizeAnalyticsEvent(
      validEvent({ durationMs: 999_999_999, scrollPct: 500 }),
    );
    expect(event?.durationMs).toBe(86_400_000);
    expect(event?.scrollPct).toBe(100);
  });

  it("sanitiza props e rótulo do elemento", () => {
    const event = normalizeAnalyticsEvent(
      validEvent({
        element: "joao@gwg.com",
        props: { password: "x", page: "/tarefas" },
      }),
    );
    expect(event?.element).toBe("[email]");
    expect(event?.props).toEqual({ page: "/tarefas" });
  });
});

describe("normalizeAnalyticsBatch", () => {
  it("descarta inválidos e limita a 25 eventos", () => {
    const events = Array.from({ length: 30 }, (_, i) =>
      validEvent({ id: `evt_${i}`, sessionId: `s_${i}` }),
    );
    events.push({ type: "inválido" } as never);
    const batch = normalizeAnalyticsBatch({ events });
    expect(batch).toHaveLength(25);
    expect(batch.every((event) => event.id.startsWith("evt_"))).toBe(true);
  });

  it("tolera payloads malformados", () => {
    expect(normalizeAnalyticsBatch(null)).toEqual([]);
    expect(normalizeAnalyticsBatch({ events: "x" })).toEqual([]);
    expect(normalizeAnalyticsBatch({})).toEqual([]);
  });
});

describe("deviceFromViewport", () => {
  it("classifica mobile, tablet e desktop", () => {
    expect(deviceFromViewport(390)).toBe("mobile");
    expect(deviceFromViewport(820)).toBe("tablet");
    expect(deviceFromViewport(1440)).toBe("desktop");
  });
});
