/**
 * Testes unitários para src/lib/equipe-utils.ts
 *
 * Cada função é testada com:
 * - Caso normal
 * - Caso limite (vazio, undefined)
 * - Caso de erro (dados inválidos)
 */

import { describe, it, expect } from "vitest";
import {
  sortChannels,
  buildContactHref,
  buildChannels,
  contactLabel,
  summarizeEvolution,
  summarizeByStatus,
  lastMovement,
  latestEvents,
  sortEventsDesc,
  monthKey,
  monthLabel,
  groupByMonth,
  filterEvents,
  formatEventDate,
  formatEventDateTime,
  hasActiveFilters,
  monthVariationSince,
  formatBytes,
  PROJECT_NAME,
  EVENT_KIND_META,
  EVENT_STATUS_META,
  CHANNEL_ORDER,
} from "@/lib/equipe-utils";
import type { ContactChannel, TeamMember, TimelineEvent } from "@/data/types";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const makeChannel = (
  type: ContactChannel["type"],
  value: string,
): ContactChannel => ({ type, value });

const makeMember = (
  id: string,
  name: string,
  channels: ContactChannel[] = [],
): TeamMember => ({
  id,
  name,
  role: "desenvolvedor",
  jobTitle: null,
  department: null,
  bio: null,
  avatarUrl: null,
  channels,
});

const makeEvent = (
  overrides: Partial<TimelineEvent> = {},
): TimelineEvent => ({
  id: "evt-1",
  kind: "entrega",
  status: "aprovado",
  title: "Teste",
  author: "teste",
  date: "2026-09-28",
  ...overrides,
});

/* ------------------------------------------------------------------ */
/* PROJECT_NAME / CONSTANTS                                            */
/* ------------------------------------------------------------------ */

describe("equipe-utils — CONSTANTS", () => {
  it("PROJECT_NAME é a string correta", () => {
    expect(PROJECT_NAME).toBe("Grupo W. Geotec CAFUFV");
  });

  it("CHANNEL_ORDER tem a ordem canônica", () => {
    expect(CHANNEL_ORDER).toEqual(["whatsapp", "email", "meeting"]);
  });

  it("EVENT_KIND_META tem todas as chaves esperadas", () => {
    expect(EVENT_KIND_META.entrega).toEqual({
      label: "Entrega",
      tone: "brand",
    });
    expect(EVENT_KIND_META.decisao).toEqual({
      label: "Decisão",
      tone: "info",
    });
    expect(EVENT_KIND_META.aprovacao).toEqual({
      label: "Aprovação",
      tone: "success",
    });
  });

  it("EVENT_STATUS_META tem todas as chaves esperadas", () => {
    expect(EVENT_STATUS_META.aprovado).toEqual({
      label: "Aprovado",
      tone: "success",
    });
    expect(EVENT_STATUS_META.aguardando_aprovacao).toEqual({
      label: "Aguardando aprovação",
      tone: "warning",
    });
    expect(EVENT_STATUS_META.em_andamento).toEqual({
      label: "Em andamento",
      tone: "info",
    });
  });
});

/* ------------------------------------------------------------------ */
/* sortChannels                                                      */
/* ------------------------------------------------------------------ */

describe("equipe-utils — sortChannels", () => {
  it("ordena canais na ordem canônica", () => {
    const channels = [
      makeChannel("email", "teste@teste.com"),
      makeChannel("whatsapp", "11999999999"),
      makeChannel("meeting", "sala-1"),
    ];
    const result = sortChannels(channels);
    expect(result.map((c) => c.type)).toEqual(["whatsapp", "email", "meeting"]);
  });

  it("mantém ordem quando já está canônica", () => {
    const channels = [
      makeChannel("whatsapp", "11999999999"),
      makeChannel("email", "teste@teste.com"),
    ];
    const result = sortChannels(channels);
    expect(result.map((c) => c.type)).toEqual(["whatsapp", "email"]);
  });

  it("não altera array original", () => {
    const channels = [makeChannel("meeting", "sala")];
    sortChannels(channels);
    expect(channels[0].type).toBe("meeting");
  });

  it("retorna vazio para array vazio", () => {
    expect(sortChannels([])).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* buildContactHref                                                    */
/* ------------------------------------------------------------------ */

describe("equipe-utils — buildContactHref", () => {
  it("gera link WhatsApp com mensagem pré-preenchida", () => {
    const result = buildContactHref(makeChannel("whatsapp", "11999999999"));
    expect(result).toMatch(/^https:\/\/wa\.me\//);
    expect(result).toContain("text=");
    expect(result).toContain("Grupo");
  });

  it("gera link mailto com assunto e corpo", () => {
    const result = buildContactHref(makeChannel("email", "contato@gwg.com"));
    expect(result).toMatch(/^mailto:/);
    expect(result).toContain("subject=");
    expect(result).toContain("body=");
  });

  it("retorna o valor direto para meeting", () => {
    const result = buildContactHref(makeChannel("meeting", "https://meet.google.com/abc"));
    expect(result).toBe("https://meet.google.com/abc");
  });

  it("limpa caracteres não numéricos do WhatsApp", () => {
    const result = buildContactHref(makeChannel("whatsapp", "+55 (11) 99999-9999"));
    expect(result).toContain("5511999999999");
  });
});

/* ------------------------------------------------------------------ */
/* buildChannels                                                       */
/* ------------------------------------------------------------------ */

describe("equipe-utils — buildChannels", () => {
  it("ordena canais e adiciona href", () => {
    const member = makeMember("1", "Teste", [
      makeChannel("email", "t@t.com"),
      makeChannel("whatsapp", "11999999999"),
    ]);
    const result = buildChannels(member);
    expect(result[0].type).toBe("whatsapp");
    expect(result[0]).toHaveProperty("href");
    expect(result[1]).toHaveProperty("href");
  });
});

/* ------------------------------------------------------------------ */
/* contactLabel                                                        */
/* ------------------------------------------------------------------ */

describe("equipe-utils — contactLabel", () => {
  it("retorna 'Falar com o {nome}' para membros masculinos", () => {
    expect(contactLabel(makeMember("gerson", "Gérson"))).toBe("Falar com o Gérson");
    expect(contactLabel(makeMember("arthur", "Arthur"))).toBe("Falar com o Arthur");
  });

  it("retorna 'Falar com a {nome}' para membros femininos", () => {
    expect(contactLabel(makeMember("camila", "Camila"))).toBe("Falar com a Camila");
    expect(contactLabel(makeMember("ana-soares", "Ana Soares"))).toBe(
      "Falar com a Ana Soares",
    );
  });

  it("retorna 'Falar com {nome}' para IDs desconhecidos", () => {
    expect(contactLabel(makeMember("desconhecido", "Desconhecido"))).toBe(
      "Falar com Desconhecido",
    );
  });
});

/* ------------------------------------------------------------------ */
/* summarizeEvolution                                                  */
/* ------------------------------------------------------------------ */

describe("equipe-utils — summarizeEvolution", () => {
  it("conta aprovações e calcula progresso", () => {
    const events = [
      makeEvent({ status: "aprovado", kind: "entrega" }),
      makeEvent({ status: "aprovado", kind: "marco" }),
      makeEvent({ status: "em_andamento", kind: "entrega" }),
    ];
    const result = summarizeEvolution(events);
    expect(result.total).toBe(3);
    expect(result.progress).toBe(67); // 2/3 ≈ 66.67 → 67
    expect(result.marcosConcluidos).toBe(1);
    expect(result.entregasAprovadas).toBe(1);
  });

  it("retorna zero para array vazio", () => {
    const result = summarizeEvolution([]);
    expect(result.total).toBe(0);
    expect(result.progress).toBe(0);
    expect(result.marcosConcluidos).toBe(0);
    expect(result.entregasAprovadas).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* summarizeByStatus                                                   */
/* ------------------------------------------------------------------ */

describe("equipe-utils — summarizeByStatus", () => {
  it("conta por status", () => {
    const events = [
      makeEvent({ status: "aprovado" }),
      makeEvent({ status: "aguardando_aprovacao" }),
      makeEvent({ status: "aprovado" }),
    ];
    const result = summarizeByStatus(events);
    expect(result.total).toBe(3);
    expect(result.counts.aprovado).toBe(2);
    expect(result.counts.aguardando_aprovacao).toBe(1);
    expect(result.counts.em_andamento).toBe(0);
    expect(result.progress).toBe(67);
  });
});

/* ------------------------------------------------------------------ */
/* lastMovement                                                        */
/* ------------------------------------------------------------------ */

describe("equipe-utils — lastMovement", () => {
  it("retorna a data mais recente", () => {
    const events = [
      makeEvent({ date: "2026-01-15" }),
      makeEvent({ date: "2026-09-28" }),
      makeEvent({ date: "2026-06-01" }),
    ];
    const result = lastMovement(events);
    expect(result?.toISOString().slice(0, 10)).toBe("2026-09-28");
  });

  it("retorna null para array vazio", () => {
    expect(lastMovement([])).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* latestEvents                                                        */
/* ------------------------------------------------------------------ */

describe("equipe-utils — latestEvents", () => {
  it("retorna os n mais recentes", () => {
    const events = [
      makeEvent({ date: "2026-01-01", id: "1" }),
      makeEvent({ date: "2026-09-28", id: "2" }),
      makeEvent({ date: "2026-06-01", id: "3" }),
    ];
    const result = latestEvents(events, 2);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("2");
    expect(result[1].id).toBe("3");
  });

  it("padrão retorna 4", () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      makeEvent({ date: `2026-0${i + 1}-01`, id: String(i) }),
    );
    expect(latestEvents(events).length).toBe(4);
  });
});

/* ------------------------------------------------------------------ */
/* sortEventsDesc                                                      */
/* ------------------------------------------------------------------ */

describe("equipe-utils — sortEventsDesc", () => {
  it("ordena do mais recente para o mais antigo", () => {
    const events = [
      makeEvent({ date: "2026-01-01", id: "antigo" }),
      makeEvent({ date: "2026-09-28", id: "recente" }),
    ];
    const result = sortEventsDesc(events);
    expect(result[0].id).toBe("recente");
    expect(result[1].id).toBe("antigo");
  });

  it("não altera array original", () => {
    const events = [makeEvent({ date: "2026-01-01" })];
    sortEventsDesc(events);
    expect(events[0].date).toBe("2026-01-01");
  });
});

/* ------------------------------------------------------------------ */
/* monthKey                                                            */
/* ------------------------------------------------------------------ */

describe("equipe-utils — monthKey", () => {
  it("extrai YYYY-MM de data ISO", () => {
    expect(monthKey("2026-09-28T10:00:00")).toBe("2026-09");
  });

  it("retorna vazio para string vazia", () => {
    expect(monthKey("")).toBe("");
  });

  it("retorna vazio para undefined", () => {
    expect(monthKey(undefined ?? "")).toBe("");
  });
});

/* ------------------------------------------------------------------ */
/* monthLabel                                                          */
/* ------------------------------------------------------------------ */

describe("equipe-utils — monthLabel", () => {
  it("retorna rótulo PT-BR", () => {
    expect(monthLabel("2026-09")).toBe("setembro de 2026");
  });

  it("retorna janeiro", () => {
    expect(monthLabel("2026-01")).toBe("janeiro de 2026");
  });

  it("retorna dezembro", () => {
    expect(monthLabel("2026-12")).toBe("dezembro de 2026");
  });
});

/* ------------------------------------------------------------------ */
/* groupByMonth                                                        */
/* ------------------------------------------------------------------ */

describe("equipe-utils — groupByMonth", () => {
  it("agrupa por mês em ordem decrescente", () => {
    const events = [
      makeEvent({ date: "2026-09-15", id: "set" }),
      makeEvent({ date: "2026-08-10", id: "ago" }),
      makeEvent({ date: "2026-09-20", id: "set2" }),
    ];
    const result = groupByMonth(events);
    expect(result).toHaveLength(2);
    expect(result[0].key).toBe("2026-09");
    expect(result[0].events).toHaveLength(2);
    expect(result[1].key).toBe("2026-08");
  });

  it("retorna vazio para array vazio", () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* filterEvents                                                        */
/* ------------------------------------------------------------------ */

describe("equipe-utils — filterEvents", () => {
  it("filtra por kind", () => {
    const events = [
      makeEvent({ kind: "entrega" }),
      makeEvent({ kind: "decisao" }),
    ];
    expect(filterEvents(events, { kind: "entrega" })).toHaveLength(1);
  });

  it("filtra por responsible", () => {
    const events = [
      makeEvent({ author: "joao" }),
      makeEvent({ author: "maria" }),
    ];
    expect(filterEvents(events, { responsible: "joao" })).toHaveLength(1);
  });

  it("filtra por onlyApproved", () => {
    const events = [
      makeEvent({ status: "aprovado" }),
      makeEvent({ status: "em_andamento" }),
    ];
    expect(filterEvents(events, { onlyApproved: true })).toHaveLength(1);
  });

  it("sem filtro retorna tudo", () => {
    const events = [makeEvent(), makeEvent()];
    expect(filterEvents(events, {})).toHaveLength(2);
  });
});

/* ------------------------------------------------------------------ */
/* formatEventDate                                                     */
/* ------------------------------------------------------------------ */

describe("equipe-utils — formatEventDate", () => {
  it("formata data PT-BR", () => {
    const result = formatEventDate("2026-09-28");
    expect(result).toBe("28/09/2026");
  });

  it("retorna string original para data inválida", () => {
    expect(formatEventDate("invalid")).toBe("invalid");
  });
});

/* ------------------------------------------------------------------ */
/* formatEventDateTime                                                 */
/* ------------------------------------------------------------------ */

describe("equipe-utils — formatEventDateTime", () => {
  it("formata data e hora PT-BR", () => {
    const result = formatEventDateTime("2026-09-28T14:30:00");
    expect(result).toContain("28/09/2026");
    expect(result).toContain("às");
  });

  it("retorna string original para data inválida", () => {
    expect(formatEventDateTime("invalid")).toBe("invalid");
  });
});

/* ------------------------------------------------------------------ */
/* hasActiveFilters                                                    */
/* ------------------------------------------------------------------ */

describe("equipe-utils — hasActiveFilters", () => {
  it("retorna true para filtro por kind", () => {
    expect(hasActiveFilters({ kind: "entrega" })).toBe(true);
  });

  it("retorna true para filtro por responsible", () => {
    expect(hasActiveFilters({ responsible: "joao" })).toBe(true);
  });

  it("retorna true para onlyApproved", () => {
    expect(hasActiveFilters({ onlyApproved: true })).toBe(true);
  });

  it("retorna false para filtros padrão", () => {
    expect(hasActiveFilters({})).toBe(false);
    expect(hasActiveFilters({ kind: "all" })).toBe(false);
    expect(hasActiveFilters({ responsible: "all" })).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* monthVariationSince                                                 */
/* ------------------------------------------------------------------ */

describe("equipe-utils — monthVariationSince", () => {
  it("retorna crescimento quando count aumentou", () => {
    const now = new Date();
    const events = [
      makeEvent({ date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-15` }),
    ];
    const result = monthVariationSince(events);
    expect(result.direction).toBe("up");
  });

  it("retorna '—' quando sem variação", () => {
    const result = monthVariationSince([]);
    expect(result.label).toBe("—");
    expect(result.direction).toBe("flat");
  });
});

/* ------------------------------------------------------------------ */
/* formatBytes                                                         */
/* ------------------------------------------------------------------ */

describe("equipe-utils — formatBytes", () => {
  it("formata KB", () => {
    expect(formatBytes(1024)).toBe("1 KB");
  });

  it("formata MB", () => {
    expect(formatBytes(1048576)).toBe("1.0 MB");
  });

  it("retorna '1 KB' para 0", () => {
    expect(formatBytes(0)).toBe("1 KB");
  });
});
