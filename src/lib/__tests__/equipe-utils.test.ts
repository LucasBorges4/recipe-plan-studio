import { describe, it, expect } from "vitest";
import type { TimelineEvent } from "@/data/types";
import {
  summarizeByStatus,
  summarizeEvolution,
  lastMovement,
  latestEvents,
  groupByMonth,
  sortEventsDesc,
  filterEvents,
  buildContactHref,
  buildChannels,
  formatBytes,
  formatEventDate,
  formatEventDateTime,
  hasActiveFilters,
  contactLabel,
  EVENT_KIND_META,
  EVENT_STATUS_META,
} from "@/lib/equipe-utils";
import type { TeamMember } from "@/data/types";

function ev(partial: Partial<TimelineEvent>): TimelineEvent {
  return {
    id: "e1",
    kind: "atualizacao",
    title: "Título",
    description: "Descrição",
    author: "Gérson",
    date: "2026-03-10T10:00:00.000Z",
    status: "aprovado",
    attachments: [],
    comments: [],
    ...partial,
  };
}

describe("summarizeByStatus (RF08)", () => {
  it("conta corretamente por status a partir dos dados", () => {
    const events = [
      ev({ status: "aprovado" }),
      ev({ status: "aprovado" }),
      ev({ status: "em_andamento" }),
      ev({ status: "aguardando_aprovacao" }),
    ];
    const s = summarizeByStatus(events);
    expect(s.counts.aprovado).toBe(2);
    expect(s.counts.em_andamento).toBe(1);
    expect(s.counts.aguardando_aprovacao).toBe(1);
    expect(s.progress).toBe(50);
  });

  it("sem eventos retorna zeros e progresso 0", () => {
    const s = summarizeByStatus([]);
    expect(s.total).toBe(0);
    expect(s.progress).toBe(0);
  });

  it("lastMovement retorna a data mais recente", () => {
    const events = [
      ev({ date: "2026-03-10T00:00:00.000Z" }),
      ev({ date: "2026-05-01T00:00:00.000Z" }),
      ev({ date: "2026-01-02T00:00:00.000Z" }),
    ];
    expect(lastMovement(events)?.toISOString().slice(0, 10)).toBe("2026-05-01");
  });

  it("lastMovement é null sem eventos", () => {
    expect(lastMovement([])).toBeNull();
  });
});

describe("latestEvents (RF09)", () => {
  it("traz os eventos mais recentes em ordem decrescente", () => {
    const events = [
      ev({ id: "a", date: "2026-01-01T00:00:00.000Z" }),
      ev({ id: "b", date: "2026-04-01T00:00:00.000Z" }),
      ev({ id: "c", date: "2026-03-01T00:00:00.000Z" }),
      ev({ id: "d", date: "2026-05-01T00:00:00.000Z" }),
    ];
    const lat = latestEvents(events, 3);
    expect(lat.map((e) => e.id)).toEqual(["d", "b", "c"]);
  });
});

describe("summarizeEvolution (RF09)", () => {
  it("conta entregas aprovadas e marcos concluídos", () => {
    const events = [
      ev({ kind: "entrega", status: "aprovado" }),
      ev({ kind: "entrega", status: "aprovado" }),
      ev({ kind: "marco", status: "aprovado" }),
      ev({ kind: "marco", status: "em_andamento" }),
      ev({ kind: "atualizacao", status: "aguardando_aprovacao" }),
    ];
    const s = summarizeEvolution(events);
    expect(s.entregasAprovadas).toBe(2);
    expect(s.marcosConcluidos).toBe(1);
    expect(s.counts.em_andamento).toBe(1);
    expect(s.progress).toBe(60);
  });

  it("sem eventos retorna zeros", () => {
    const s = summarizeEvolution([]);
    expect(s.total).toBe(0);
    expect(s.progress).toBe(0);
    expect(s.marcosConcluidos).toBe(0);
  });
});

describe("formatEventDateTime (RF12)", () => {
  it("formata data e hora em PT-BR", () => {
    const out = formatEventDateTime("2026-09-15T13:45:00.000Z");
    expect(out).toMatch(/^\d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}$/);
  });

  it("retorna o valor bruto quando a data é inválida", () => {
    expect(formatEventDateTime("nao-e-data")).toBe("nao-e-data");
  });
});

describe("hasActiveFilters (RF17)", () => {
  it("detecta filtros ativos", () => {
    expect(hasActiveFilters({ kind: "entrega" })).toBe(true);
    expect(hasActiveFilters({ responsible: "Camila" })).toBe(true);
    expect(hasActiveFilters({ onlyApproved: true })).toBe(true);
  });

  it("estado padrão não é ativo", () => {
    expect(hasActiveFilters({ kind: "all", responsible: "all", onlyApproved: false })).toBe(false);
    expect(hasActiveFilters({})).toBe(false);
  });
});

describe("contactLabel (RF03-copy)", () => {
  const lead: TeamMember = { id: "gerson", name: "Gérson", role: "R", area: "", tier: "lead", channels: [] };
  const secondary: TeamMember = { id: "camila", name: "Camila", role: "R", area: "", tier: "secondary", channels: [] };
  const member: TeamMember = { id: "x", name: "Pessoa", role: "R", area: "", tier: "member", channels: [] };

  it("usa artigo para líderes e nome simples para outros", () => {
    expect(contactLabel(lead)).toBe("Falar com o Gérson");
    expect(contactLabel(secondary)).toBe("Falar com a Camila");
    expect(contactLabel(member)).toBe("Falar com Pessoa");
  });
});

describe("groupByMonth (RF10)", () => {
  it("agrupa por mês e ordena do mais novo ao mais antigo", () => {
    const events = [
      ev({ id: "a", date: "2026-03-10T00:00:00.000Z" }),
      ev({ id: "b", date: "2026-05-01T00:00:00.000Z" }),
      ev({ id: "c", date: "2026-03-15T00:00:00.000Z" }),
      ev({ id: "d", date: "2026-02-01T00:00:00.000Z" }),
    ];
    const groups = groupByMonth(events);
    expect(groups.map((g) => g.key)).toEqual(["2026-05", "2026-03", "2026-02"]);
    expect(groups[1]!.events.map((e) => e.id)).toEqual(["c", "a"]);
  });

  it("roda sem eventos", () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

describe("filterEvents (RF14)", () => {
  it("filtra por tipo", () => {
    const events = [
      ev({ id: "a", kind: "entrega" }),
      ev({ id: "b", kind: "marco" }),
      ev({ id: "c", kind: "entrega" }),
    ];
    expect(filterEvents(events, { kind: "entrega" }).map((e) => e.id)).toEqual(["a", "c"]);
  });

  it("filtra por responsável", () => {
    const events = [ev({ id: "a", author: "Gérson" }), ev({ id: "b", author: "Camila" })];
    expect(filterEvents(events, { responsible: "Camila" }).map((e) => e.id)).toEqual(["b"]);
  });

  it("filtra somente aprovados", () => {
    const events = [ev({ id: "a", status: "aprovado" }), ev({ id: "b", status: "em_andamento" })];
    expect(filterEvents(events, { onlyApproved: true }).map((e) => e.id)).toEqual(["a"]);
  });

  it("sem resultado retorna lista vazia (RF15)", () => {
    const events = [ev({ kind: "marco" })];
    expect(filterEvents(events, { kind: "decisao" })).toEqual([]);
  });

  it("'all' não filtra", () => {
    const events = [ev({ kind: "marco" }), ev({ kind: "entrega" })];
    expect(filterEvents(events, { kind: "all", responsible: "all" })).toHaveLength(2);
  });
});

describe("canais de contato (RF05-RF07)", () => {
  const sample: TeamMember = {
    id: "p1",
    name: "Pessoa",
    role: "Role",
    area: "Área",
    tier: "member",
    channels: [
      { type: "email", label: "E-mail", value: "x@y.com" },
      { type: "whatsapp", label: "WhatsApp", value: "+5511999998888" },
    ],
  };

  it("WhatsApp usa wa.me com número limpo e texto pré-preenchido", () => {
    const href = buildContactHref({ type: "whatsapp", label: "WhatsApp", value: "+55 (11) 99999-8888" });
    expect(href).toContain("https://wa.me/5511999998888?text=");
    expect(decodeURIComponent(href)).toContain("GRUPO GWG");
  });

  it("e-mail usa mailto com assunto e corpo", () => {
    const href = buildContactHref({ type: "email", label: "E-mail", value: "x@y.com" });
    expect(href).toContain("mailto:x@y.com?subject=");
    expect(href).toContain("body=");
  });

  it("buildChannels ordena WhatsApp antes de e-mail", () => {
    const ch = buildChannels(sample);
    expect(ch[0]!.type).toBe("whatsapp");
    expect(ch[1]!.type).toBe("email");
    expect(ch[0]!.href).toContain("wa.me");
  });

  it("sem canais retorna lista vazia", () => {
    expect(buildChannels({ ...sample, channels: [] })).toEqual([]);
  });
});

describe("metadados e formatação", () => {
  it("EVENT_KIND_META cobre os 6 tipos", () => {
    expect(Object.keys(EVENT_KIND_META).sort()).toEqual(
      ["aprovacao", "atualizacao", "decisao", "entrega", "integracao", "marco"].sort(),
    );
  });
  it("EVENT_STATUS_META cobre os 3 status", () => {
    expect(Object.keys(EVENT_STATUS_META).sort()).toEqual(
      ["aguardando_aprovacao", "aprovado", "em_andamento"].sort(),
    );
  });
  it("formatBytes exibe KB e MB", () => {
    expect(formatBytes(500)).toBe("1 KB");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
  it("formatEventDate exibe dd/mm/aaaa", () => {
    expect(formatEventDate("2026-09-15T00:00:00.000Z")).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
  it("sortEventsDesc ordena decrescente", () => {
    const events = [ev({ id: "a", date: "2026-01-01T00:00:00.000Z" }), ev({ id: "b", date: "2026-06-01T00:00:00.000Z" })];
    expect(sortEventsDesc(events).map((e) => e.id)).toEqual(["b", "a"]);
  });
});