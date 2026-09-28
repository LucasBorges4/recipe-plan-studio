import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useRef } from "react";
import {
  BookOpen,
  Plus,
  Search,
  Clock,
  FileCheck,
  Scale,
  ShieldCheck,
  Info,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { TimelineList } from "@/components/timeline/TimelineList";
import { LatestUpdates } from "@/components/timeline/LatestUpdates";
import { ProgressSummary } from "@/components/timeline/ProgressSummary";
import {
  summarizeEvolution,
  summarizeByStatus,
  lastMovement,
  latestEvents,
  formatEventDateTime,
  monthVariationSince,
} from "@/lib/equipe-utils";
import { userCan } from "@/lib/rbac";
import { useSession, usePortalData } from "@/lib/api-hooks";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { TimelineEventKind, TimelineEventStatus, TimelineEvent } from "@/data/types";
import {
  createJournalEntryFn,
  approveJournalEntryFn,
} from "@/lib/portal-api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/diario")({
  validateSearch: (search) => ({ tipo: (search['tipo'] as string) || "Todos" }),
  head: () => ({
    meta: [
      { title: "Diário de Bordo — Portal de Governança GWG — Grupo W. Geotec" },
      {
        name: "description",
        content:
          "Histórico oficial da evolução do projeto: marcos, entregas, integrações, decisões, aprovações e atualizações.",
      },
      { property: "og:title", content: "Diário de Bordo — GWG — Grupo W. Geotec" },
      {
        property: "og:description",
        content: "Marcos, entregas e evolução do projeto ERP do GWG — Grupo W. Geotec.",
      },
      { property: "og:type", content: "website" },
      { property: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DiarioPage,
});

const filterLabels: Record<string, string> = {
  Todos: "Todos",
  Entrega: "Entrega",
  Integração: "Integração",
  Marco: "Marco",
  Decisão: "Decisão",
  Aprovação: "Aprovação",
  Atualização: "Atualização",
};

const filterKinds = [
  "Todos",
  "Entrega",
  "Integração",
  "Marco",
  "Decisão",
  "Aprovação",
  "Atualização",
] as const;

function mapJournalToEvent(entry: import("@/data/types").JournalEntry): TimelineEvent {
  const kindMap: Record<string, TimelineEventKind> = {
    Entrega: "entrega",
    Integração: "integracao",
    Marco: "marco",
    Decisão: "decisao",
    Aprovação: "aprovacao",
    Atualização: "atualizacao",
  };
  const statusMap: Record<string, TimelineEventStatus> = {
    "Em andamento": "em_andamento",
    Entregue: "aprovado",
    "Aguardando aprovação": "aguardando_aprovacao",
    "Aprovado pelo cliente": "aprovado",
    Concluído: "aprovado",
    "Requer atenção": "em_andamento",
  };
  const ev: TimelineEvent = {
    id: entry.id,
    kind: kindMap[entry.type] ?? "atualizacao",
    title: entry.title,
    description: entry.description,
    author: entry.authorName,
    date: entry.occurredAt,
    status: statusMap[entry.status] ?? "em_andamento",
    attachments: entry.attachments.map((a) => ({
      id: a.id,
      name: a.name,
      mime: a.mimeType,
      size: a.size,
      url: `#${a.id}`,
    })),
    comments: entry.comments.map((c) => ({
      id: c.id,
      author: c.authorName,
      date: c.createdAt,
      text: c.content,
    })),
  };
  if (entry.approvedBy !== undefined && entry.approvedBy !== null) {
    (ev as any).approvedBy = entry.approvedBy;
  }
  if (entry.approvedAt !== undefined && entry.approvedAt !== null) {
    (ev as any).approvedAt = entry.approvedAt;
  }
  return ev;
}

function DiarioPage() {
  const { data: session } = useSession();
  const { data: portalData } = usePortalData();
  const queryClient = useQueryClient();
  const mayManage = !!session?.user && userCan(session.user, "journal.manage");
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const journal = portalData?.journal ?? [];
  const events: TimelineEvent[] = useMemo(() => journal.map(mapJournalToEvent), [journal]);

  // Estado de filtros e busca
  const [filter, setFilter] = useState<(typeof filterKinds)[number]>((search['tipo'] as string === "Todos" ? "Todos" : search['tipo'] as typeof filterKinds[number]) ?? "Todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  // Estado do formulário de nova atualização
  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState<"Entrega" | "Integração" | "Marco" | "Decisão" | "Aprovação" | "Atualização">("Atualização");
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formStatus, setFormStatus] = useState<"Em andamento" | "Entregue" | "Aguardando aprovação" | "Aprovado pelo cliente" | "Concluído" | "Requer atenção">("Em andamento");
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Foco no primeiro campo ao abrir o modal
  const firstFieldRef = useRef<HTMLSelectElement>(null);

  // Aplicar filtros e busca
  const filteredEvents = useMemo(() => {
    let result = events;
    if (filter !== "Todos") {
      const kindMap: Record<string, string> = {
        Entrega: "entrega",
        Integração: "integracao",
        Marco: "marco",
        Decisão: "decisao",
        Aprovação: "aprovacao",
        Atualização: "atualizacao",
      };
      const kindKey = kindMap[filter] as TimelineEventKind | undefined;
      if (kindKey) {
        result = result.filter((e) => e.kind === kindKey);
      }
    }
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.description ?? "").toLowerCase().includes(q) ||
          (e.author ?? "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [events, filter, searchQuery]);

  const sortedEvents = useMemo(
    () => [...filteredEvents].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [filteredEvents],
  );

  const dirtyFilters = filter !== "Todos" || searchQuery.trim().length > 0;

  // Indicadores
  const lastUpdate = lastMovement(events);
  const evolution = summarizeEvolution(events);
  const stats = summarizeByStatus(events);
  const totalRecords = events.length;
  const totalDeliveries = events.filter((e) => e.kind === "entrega").length;
  const totalDecisions = events.filter((e) => e.kind === "decisao").length;
  const latestFive = latestEvents(events, 5);

  // Variação mensal real
  const monthVariation = monthVariationSince(events, "all") ?? { label: "—", direction: "flat" };

  // Resumo determinístico
  const summaryText = useMemo(() => {
    const parts: string[] = [];
    const total = events.length;
    if (total === 0) {
      parts.push("Nenhum registro no histórico ainda.");
      return parts.join(" ");
    }
    const aprovados = stats.counts.aprovado;
    const andamento = stats.counts.em_andamento;
    const aguardando = stats.counts.aguardando_aprovacao;
    parts.push(`Total de ${total} registro${total === 1 ? "" : "s"}.`);
    parts.push(`${aprovados} concluído${aprovados === 1 ? "" : "s"}.`);
    if (andamento > 0) parts.push(`${andamento} em andamento.`);
    if (aguardando > 0) parts.push(`${aguardando} aguardando aprovação.`);
    return parts.join(" ");
  }, [events, stats]);

  // Atualizar filtro na URL ao trocar
  function setFilterWithUrl(f: (typeof filterKinds)[number]) {
    setFilter(f);
    navigate({ search: { tipo: f } });
  }

  // Ações do formulário
  async function handleCreate() {
    if (!formTitle.trim() || !formDesc.trim()) {
      toast.error("Preencha título e descrição.");
      return;
    }
    if (formSubmitting) return;
    setFormSubmitting(true);
    try {
      const result = await createJournalEntryFn({
        data: {
          type: formType,
          title: formTitle,
          description: formDesc,
          occurredAt: new Date().toISOString(),
          status: formStatus,
          authorId: session?.user?.id ?? "",
          authorName: session?.user?.name ?? "",
          comments: [],
          attachments: [],
        },
      });
      if (!result.ok) {
        toast.error(result.error ?? "Erro ao salvar.");
      } else {
        toast.success("Atualização registrada com sucesso.");
        setFormOpen(false);
        setFormTitle("");
        setFormDesc("");
        setFormStatus("Em andamento");
        queryClient.invalidateQueries({ queryKey: ["portal"] });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar.");
    } finally {
      setFormSubmitting(false);
    }
  }

  // Solicitar aprovação
  async function handleApprove(id: string, note?: string) {
    const result = await approveJournalEntryFn({ data: { id, note } });
    if (result.ok) {
      toast.success("Aprovado pelo cliente.");
      queryClient.invalidateQueries({ queryKey: ["portal"] });
    } else {
      toast.error(result.error ?? "Erro ao aprovar.");
    }
  }

  return (
    <>
      {/* Cabeçalho */}
      <PageHeader
        icon={BookOpen}
        title="Diário de Bordo"
        subtitle="Marcos, entregas e evolução do projeto"
        actions={
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:block" aria-label="Última atualização">
              Última atualização: {lastUpdate ? formatEventDateTime(lastUpdate.toISOString()) : "—"}
            </span>
            <Dialog open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) { setFormTitle(""); setFormDesc(""); setFormStatus("Em andamento"); } }}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-xs font-medium text-brand-foreground shadow-sm transition-colors hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:ring-offset-2"
                  aria-label="Criar nova atualização"
                >
                  <Plus className="size-3.5" /> Nova atualização
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-md" onOpenAutoFocus={(e) => {
                e.preventDefault();
                setTimeout(() => firstFieldRef.current?.focus(), 50);
              }}>
                <DialogHeader>
                  <DialogTitle>Nova atualização do projeto</DialogTitle>
                  <DialogDescription>
                    Registre entregas, integrações, marcos, decisões, aprovações ou atualizações gerais.
                  </DialogDescription>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleCreate();
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label htmlFor="db-type" className="mb-1 block text-xs font-medium text-foreground">
                      Tipo do registro
                    </label>
                    <select
                      id="db-type"
                      ref={firstFieldRef}
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as typeof formType)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
                      aria-required="true"
                      aria-label="Tipo do registro"
                    >
                      {filterKinds.filter((f) => f !== "Todos").map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="db-title" className="mb-1 block text-xs font-medium text-foreground">
                      Título <span className="text-danger" aria-label="obrigatório">*</span>
                    </label>
                    <input
                      id="db-title"
                      type="text"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
                      placeholder="Ex.: Entrega do módulo de integração"
                      maxLength={120}
                      required
                      aria-required="true"
                      aria-invalid={!formTitle.trim() ? "true" : "false"}
                    />
                  </div>
                  <div>
                    <label htmlFor="db-desc" className="mb-1 block text-xs font-medium text-foreground">
                      Descrição <span className="text-danger" aria-label="obrigatório">*</span>
                    </label>
                    <textarea
                      id="db-desc"
                      value={formDesc}
                      onChange={(e) => setFormDesc(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
                      placeholder="Descreva o que ocorreu, quem realizou e qual o impacto."
                      rows={3}
                      maxLength={500}
                      required
                      aria-required="true"
                    />
                    <p className="mt-0.5 text-[10px] text-muted-foreground" aria-live="polite">{formDesc.length}/500 caracteres</p>
                  </div>
                  <div>
                    <label htmlFor="db-status" className="mb-1 block text-xs font-medium text-foreground">
                      Status
                    </label>
                    <select
                      id="db-status"
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as typeof formStatus)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
                    >
                      <option>Em andamento</option>
                      <option>Entregue</option>
                      <option>Aguardando aprovação</option>
                      <option>Aprovado pelo cliente</option>
                      <option>Concluído</option>
                      <option>Requer atenção</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="db-author" className="mb-1 block text-xs font-medium text-foreground">
                      Responsável
                    </label>
                    <input
                      id="db-author"
                      type="text"
                      value={session?.user?.name ?? ""}
                      readOnly
                      disabled
                      className="w-full rounded-md border border-input bg-muted px-3 py-2 text-xs text-foreground opacity-70"
                      aria-label="Responsável"
                    />
                  </div>
                  <div>
                    <label htmlFor="db-date" className="mb-1 block text-xs font-medium text-foreground">
                      Data/hora
                    </label>
                    <input
                      id="db-date"
                      type="datetime-local"
                      value={new Date().toISOString().slice(0, 16)}
                      readOnly
                      disabled
                      className="w-full rounded-md border border-input bg-muted px-3 py-2 text-xs text-foreground opacity-70"
                      aria-label="Data e hora"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => { setFormOpen(false); setFormTitle(""); setFormDesc(""); setFormStatus("Em andamento"); }}
                      className="rounded-md px-3 py-2 text-xs text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={formSubmitting || !formTitle.trim() || !formDesc.trim()}
                      className="inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-xs font-medium text-brand-foreground shadow-sm transition-colors hover:bg-brand/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand/40"
                      aria-busy={formSubmitting}
                    >
                      {formSubmitting ? "Salvando..." : "Salvar atualização"}
                    </button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Indicadores */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Clock className="size-3.5 text-brand" /> Última atualização
          </div>
          <div className="mt-2 text-2xl font-extrabold text-foreground">
            {lastUpdate ? formatEventDateTime(lastUpdate.toISOString()).split(" às ")[0] : "—"}
          </div>
          <p className="mt-1 text-xs text-muted-foreground" aria-label={lastUpdate ? `Última atualização há ${formatEventDateTime(lastUpdate.toISOString())}` : "Nenhum movimento ainda"}>
            {lastUpdate ? "há poucos minutos" : "Nenhum movimento ainda"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Info className="size-3.5 text-brand" /> Registros
          </div>
          <div className="mt-2 text-2xl font-extrabold text-foreground">{totalRecords}</div>
          <p className="mt-1 text-xs text-muted-foreground" aria-label={`Variação mensal: ${monthVariation.label}`}>
            Variação mensal: {monthVariation.label}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <FileCheck className="size-3.5 text-brand" /> Entregas
          </div>
          <div className="mt-2 text-2xl font-extrabold text-foreground">{totalDeliveries}</div>
          <p className="mt-1 text-xs text-muted-foreground" aria-label={`Variação mensal de entregas: ${monthVariationSince(events, "entrega")?.label ?? "—"}`}>
            Variação mensal: {monthVariationSince(events, "entrega")?.label ?? "—"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Scale className="size-3.5 text-brand" /> Decisões
          </div>
          <div className="mt-2 text-2xl font-extrabold text-foreground">{totalDecisions}</div>
          <p className="mt-1 text-xs text-muted-foreground" aria-label={`Variação mensal de decisões: ${monthVariationSince(events, "decisao")?.label ?? "—"}`}>
            Variação mensal: {monthVariationSince(events, "decisao")?.label ?? "—"}
          </p>
        </div>
      </div>

      {/* Filtros + Timeline + Sidebar */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          {/* Barra de busca */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar registros..."
                className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand"
                aria-label="Pesquisar registros"
              />
              {searchQuery.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
                  aria-label="Limpar busca"
                >
                  <RotateCcw className="size-3" />
                </button>
              )}
            </div>
          </div>

          {/* Filtros por tipo (botões rápidos) */}
          <div className="mb-4 flex flex-wrap gap-2">
            {filterKinds.map((f) => (
              <button
                key={f}
                onClick={() => setFilterWithUrl(f)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition-colors focus:outline-none focus:ring-1 focus:ring-brand",
                  filter === f
                    ? "border-brand bg-brand text-brand-foreground font-medium"
                    : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-brand/40",
                )}
                aria-pressed={filter === f}
                aria-label={`Filtrar por ${f}`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Ação Limpar filtros */}
          {dirtyFilters && (
            <div className="mb-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setFilterWithUrl("Todos"); setSearchQuery(""); }}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-brand/30 focus:outline-none focus:ring-1 focus:ring-brand"
                aria-label="Limpar todos os filtros"
              >
                <RotateCcw className="size-3" /> Limpar filtros
              </button>
              <span className="text-xs text-muted-foreground" aria-live="polite">
                {sortedEvents.length} resultado{sortedEvents.length === 1 ? "" : "s"}
              </span>
            </div>
          )}

          {/* Linha do tempo */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <TimelineList
              events={sortedEvents}
              hasActiveFilters={dirtyFilters}
              onResetFilters={() => { setFilterWithUrl("Todos"); setSearchQuery(""); }}
            />
          </div>
        </div>

        {/* Coluna lateral */}
        <aside className="min-w-0 space-y-6">
          <section aria-label="Últimas atualizações">
            <LatestUpdates events={events} limit={5} />
          </section>

          <section aria-label="Resumo da evolução">
            <ProgressSummary events={events} />
          </section>

          {/* Resumo executivo */}
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldCheck className="size-4 text-brand" /> Resumo da evolução
            </h2>
            <p className="text-sm leading-relaxed text-foreground/90">{summaryText}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setFilterWithUrl("Aprovação"); }}
                className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-center hover:bg-accent transition-colors"
                aria-label={`Filtrar aprovações: ${stats.counts.aguardando_aprovacao}`}
              >
                <p className="text-[11px] text-muted-foreground">Aguardando aprovação</p>
                <p className="text-xl font-bold text-foreground">{stats.counts.aguardando_aprovacao}</p>
              </a>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setFilterWithUrl("Atualização"); }}
                className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-center hover:bg-accent transition-colors"
                aria-label={`Filtrar em andamento: ${stats.counts.em_andamento}`}
              >
                <p className="text-[11px] text-muted-foreground">Em andamento</p>
                <p className="text-xl font-bold text-foreground">{stats.counts.em_andamento}</p>
              </a>
            </div>
          </section>
        </aside>
      </div>

      {/* Estado vazio explícito */}
      {events.length === 0 && !dirtyFilters && (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <BookOpen className="mx-auto size-10 text-muted-foreground/40" aria-hidden="true" />
          <h2 className="mt-4 text-base font-semibold text-foreground">O Diário de Bordo ainda não possui atualizações</h2>
          <p className="mt-1 text-sm text-muted-foreground">Acompanhe aqui as entregas, decisões, aprovações, marcos e atualizações do projeto.</p>
          {mayManage && (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-xs font-medium text-brand-foreground shadow-sm transition-colors hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand/40"
            >
              <Plus className="size-3.5" /> Criar primeira atualização
            </button>
          )}
        </div>
      )}
    </>
  );
}
