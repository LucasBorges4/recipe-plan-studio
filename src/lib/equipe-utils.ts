import type {
  ContactChannel,
  TimelineEvent,
  TimelineEventKind,
  TimelineEventStatus,
  TeamMember,
} from "@/data/types";

/** Nome do projeto usado na mensagem pré-preenchida dos canais. */
export const PROJECT_NAME = "GRUPO GWG";

/** Metadados por tipo de evento (rótulo PT-BR + tom do design system). */
export const EVENT_KIND_META: Record<
  TimelineEventKind,
  { label: string; tone: "success" | "info" | "warning" | "neutral" | "brand" }
> = {
  entrega: { label: "Entrega", tone: "brand" },
  integracao: { label: "Integração", tone: "info" },
  decisao: { label: "Decisão", tone: "info" },
  aprovacao: { label: "Aprovação", tone: "success" },
  marco: { label: "Marco", tone: "warning" },
  atualizacao: { label: "Atualização", tone: "neutral" },
};

/** Metadados por status de evento (rótulo PT-BR + tom). */
export const EVENT_STATUS_META: Record<
  TimelineEventStatus,
  { label: string; tone: "success" | "info" | "warning" | "neutral" | "brand" }
> = {
  aprovado: { label: "Aprovado", tone: "success" },
  aguardando_aprovacao: { label: "Aguardando aprovação", tone: "warning" },
  em_andamento: { label: "Em andamento", tone: "info" },
};

/** Ordem canônica de exibição dos canais: WhatsApp, e-mail, agendamento. */
export const CHANNEL_ORDER: ContactChannel["type"][] = ["whatsapp", "email", "meeting"];

export function sortChannels(channels: ContactChannel[]): ContactChannel[] {
  return [...channels].sort(
    (a, b) => CHANNEL_ORDER.indexOf(a.type) - CHANNEL_ORDER.indexOf(b.type),
  );
}

/** Monta o href real do canal com mensagem pré-preenchida citando o projeto. */
export function buildContactHref(channel: ContactChannel): string {
  const msg = encodeURIComponent(`Olá! Falo sobre o projeto ${PROJECT_NAME}.`);
  switch (channel.type) {
    case "whatsapp":
      return `https://wa.me/${channel.value.replace(/\D/g, "")}?text=${msg}`;
    case "email":
      return `mailto:${channel.value}?subject=${encodeURIComponent(
        `Projeto ${PROJECT_NAME}`,
      )}&body=${msg}`;
    case "meeting":
      return channel.value;
  }
}

/** Canais ordenados e com href pronto para render. */
export function buildChannels(member: TeamMember) {
  return sortChannels(member.channels).map((c) => ({ ...c, href: buildContactHref(c) }));
}

/** Nomes com artigo definido + o artigo feminino/masculino natural em PT-BR. */
const FALAR_COM_ARTIGO: Record<string, string> = {
  gerson: "o",
  camila: "a",
  "daniel-melo": "o",
  "ana-soares": "a",
  tome: "o",
  arthur: "o",
  "michael-barbosa": "o",
};

/** Rótulo "Falar com o Gérson" / "Falar com a Camila" / "Falar com {nome}". */
export function contactLabel(member: TeamMember): string {
  const artigo = FALAR_COM_ARTIGO[member.id];
  return artigo ? `Falar com ${artigo} ${member.name}` : `Falar com ${member.name}`;
}

/** Contagem de eventos por status + progresso (aprovados / total) e marcos concluídos. */
export function summarizeEvolution(events: TimelineEvent[]) {
  const counts: Record<TimelineEventStatus, number> = {
    aprovado: 0,
    aguardando_aprovacao: 0,
    em_andamento: 0,
  };
  let marcosConcluidos = 0;
  let entregasAprovadas = 0;
  for (const e of events) {
    counts[e.status] += 1;
    if (e.status === "aprovado" && e.kind === "marco") marcosConcluidos += 1;
    if (e.status === "aprovado" && e.kind === "entrega") entregasAprovadas += 1;
  }
  const total = events.length;
  const progress = total > 0 ? Math.round((counts.aprovado / total) * 100) : 0;
  return { counts, total, progress, marcosConcluidos, entregasAprovadas };
}

/** Contagem de eventos por status + progresso (aprovados / total). */
export function summarizeByStatus(events: TimelineEvent[]) {
  const counts: Record<TimelineEventStatus, number> = {
    aprovado: 0,
    aguardando_aprovacao: 0,
    em_andamento: 0,
  };
  for (const e of events) counts[e.status] += 1;
  const total = events.length;
  const progress = total > 0 ? Math.round((counts.aprovado / total) * 100) : 0;
  return { counts, total, progress };
}

/** Última data de movimento, ou null quando não há eventos. */
export function lastMovement(events: TimelineEvent[]): Date | null {
  if (events.length === 0) return null;
  return events.reduce((max, e) => {
    const d = new Date(e.date);
    return d > max ? d : max;
  }, new Date(events[0]!.date));
}

/** Os `n` eventos mais recentes (data decrescente). */
export function latestEvents(events: TimelineEvent[], n = 4): TimelineEvent[] {
  return [...events]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, n);
}

/** Ordena eventos do mais novo ao mais antigo. */
export function sortEventsDesc(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/** Chave de mês "YYYY-MM" de uma data ISO. */
export function monthKey(date: string): string {
  return (date ?? "").slice(0, 7);
}

/** Rótulo de mês em PT-BR (ex.: "setembro de 2026"). */
export function monthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-");
  const months = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  const idx = Number(m) - 1;
  return `${months[idx] ?? ""} de ${y}`.trim();
}

/** Agrupa por mês (chave YYYY-MM), ordem decrescente de mais novo para mais antigo. */
export function groupByMonth(events: TimelineEvent[]): Array<{ key: string; events: TimelineEvent[] }> {
  const map = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    const key = monthKey(e.date);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, evs]) => ({ key, events: sortEventsDesc(evs) }));
}

export interface EventFilters {
  kind?: TimelineEventKind | "all";
  responsible?: string | "all";
  onlyApproved?: boolean;
}

/** Aplica os filtros da timeline. */
export function filterEvents(events: TimelineEvent[], filters: EventFilters): TimelineEvent[] {
  return events.filter((e) => {
    if (filters.kind && filters.kind !== "all" && e.kind !== filters.kind) return false;
    if (filters.responsible && filters.responsible !== "all" && e.author !== filters.responsible)
      return false;
    if (filters.onlyApproved && e.status !== "aprovado") return false;
    return true;
  });
}

/** Exporta data em PT-BR curta (dd/mm/aaaa). */
export function formatEventDate(date: string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Exporta data e hora em PT-BR (dd/mm/aaaa às HH:mm). */
export function formatEventDateTime(date: string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  const datePart = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timePart = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${datePart} às ${timePart}`;
}

/** Se há algum filtro ativo além do estado padrão. */
export function hasActiveFilters(filters: EventFilters): boolean {
  return (
    (filters.kind !== undefined && filters.kind !== "all") ||
    (filters.responsible !== undefined && filters.responsible !== "all") ||
    filters.onlyApproved === true
  );
}

/** Calcula variação mensal real (atual vs anterior) por tipo de evento. */
export function monthVariationSince(events: TimelineEvent[], kind?: TimelineEventKind | "all") {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevMonthKey = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();
  const filtered = kind && kind !== "all" ? events.filter((e) => e.kind === kind) : events;
  const currentCount = filtered.filter((e) => monthKey(e.date) === currentMonthKey).length;
  const prevCount = filtered.filter((e) => monthKey(e.date) === prevMonthKey).length;
  if (prevCount === 0 && currentCount === 0) return { label: "—", direction: "flat" as const };
  if (prevCount === 0) return { label: `+${currentCount > 0 ? Math.round(((currentCount - 0) / 1) * 100) : 0}%`, direction: "up" as const };
  const pct = Math.round(((currentCount - prevCount) / prevCount) * 100);
  if (pct > 0) return { label: `+${pct}%`, direction: "up" as const };
  if (pct < 0) return { label: `${pct}%`, direction: "down" as const };
  return { label: "sem variação", direction: "flat" as const };
}

/** Formata tamanho de anexo (bytes → KB/MB). */
export function formatBytes(bytes: number): string {
  if (!bytes) return "1 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}