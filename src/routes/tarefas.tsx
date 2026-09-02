import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  KanbanSquare,
  Search,
  Plus,
  LayoutGrid,
  List as ListIcon,
  Table as TableIcon,
  Check,
  X,
  Clock,
  MessageSquare,
  Inbox,
  MoreVertical,
  History,
  Flag,
  User as UserIcon,
  Tag as TagIcon,
  Calendar,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Filter,
  Sparkles,
  ArrowRight,
  GripVertical,
} from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { Initials } from "@/components/portal/ProgressBar";
import type { Priority, Task } from "@/data/types";
import { cn } from "@/lib/utils";
import { userCan } from "@/lib/rbac";
import { formatDateTime } from "@/lib/portal-utils";
import { usePortalData, useSession, useTaskHistory, qk } from "@/lib/api-hooks";
import { moveTaskFn, createTaskFn, addColumnFn, addCommentFn } from "@/lib/portal-api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/tarefas")({
  head: () => ({
    meta: [
      { title: "Tarefas — Portal de Governança Grupo Geos" },
      {
        name: "description",
        content:
          "ClickUp-style Task Board: backlog, execução, aprovações e entregas concluídas.",
      },
      { property: "og:title", content: "Tarefas — Grupo Geos" },
      {
        property: "og:description",
        content: "Board de tarefas no estilo ClickUp com visões em Board, Lista e Tabela.",
      },
    ],
  }),
  component: TarefasPage,
});

// Flag de prioridade estilo ClickUp
const priorityConfig: Record<
  Priority,
  { label: string; flagColor: string; bgColor: string; borderColor: string }
> = {
  Alta: {
    label: "Alta / Urgente",
    flagColor: "text-red-500 fill-red-500",
    bgColor: "bg-red-500/10 text-red-600 dark:text-red-400",
    borderColor: "border-l-red-500",
  },
  Média: {
    label: "Média",
    flagColor: "text-amber-500 fill-amber-500",
    bgColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    borderColor: "border-l-amber-500",
  },
  Baixa: {
    label: "Baixa",
    flagColor: "text-blue-500 fill-blue-500",
    bgColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    borderColor: "border-l-blue-500",
  },
};

// Cores dos cabeçalhos das colunas no estilo ClickUp
const columnColors: Record<string, { badge: string; dot: string }> = {
  Backlog: { badge: "bg-slate-500/15 text-slate-700 dark:text-slate-300", dot: "bg-slate-400" },
  "A Fazer": { badge: "bg-slate-500/15 text-slate-700 dark:text-slate-300", dot: "bg-slate-400" },
  "Em Progresso": { badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  "Em Execução": { badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  "Em Aprovação": {
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  "Em Revisão": {
    badge: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
    dot: "bg-purple-500",
  },
  Concluído: { badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
};

function TarefasPage() {
  const qc = useQueryClient();
  const { data: state } = usePortalData();
  const { data: session } = useSession();

  const items = state?.tasks ?? [];
  const columns = state?.columns ?? [];
  const comments = state?.comments ?? [];

  const user = session?.user ?? null;
  const may = (p: Parameters<typeof userCan>[1]) => !!user && userCan(user, p);

  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("Todas");
  const [assignee, setAssignee] = useState("Todos");
  const [moduleFilter, setModuleFilter] = useState("Todos módulos");
  const [view, setView] = useState<"board" | "list" | "table">("board");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [quickAddCol, setQuickAddCol] = useState<string | null>(null);
  const [quickTitle, setQuickTitle] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("Média");
  const [newAssignee, setNewAssignee] = useState("");
  const [newDue, setNewDue] = useState("");

  const detail = items.find((t) => t.id === detailId) ?? null;
  const { data: historyRes } = useTaskHistory(detailId);
  const detailHistory = historyRes?.ok ? historyRes.data : [];

  const moveM = useMutation({
    mutationFn: (v: { taskId: string; column: string }) => moveTaskFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.portal }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao mover a tarefa."),
  });

  const createM = useMutation({
    mutationFn: (v: { title: string; priority: Priority; assignee: string; due?: string }) =>
      createTaskFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.portal });
      toast.success("Tarefa criada com sucesso.");
      setCreating(false);
      setQuickAddCol(null);
      setQuickTitle("");
      setNewTitle("");
      setNewAssignee("");
      setNewDue("");
      setNewPriority("Média");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao criar a tarefa."),
  });

  const columnM = useMutation({
    mutationFn: (v: { name: string }) => addColumnFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.portal }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao adicionar a coluna."),
  });

  const commentM = useMutation({
    mutationFn: (v: { taskId: string; body: string }) => addCommentFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.portal }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao comentar."),
  });

  const assignees = useMemo(
    () => ["Todos", ...Array.from(new Set(items.map((t) => t.assignee)))],
    [items],
  );
  const modulesList = useMemo(
    () => ["Todos módulos", ...Array.from(new Set(items.flatMap((t) => t.tags)))],
    [items],
  );

  const filtered = items.filter(
    (t) =>
      t.title.toLowerCase().includes(query.toLowerCase()) &&
      (priority === "Todas" || t.priority === priority) &&
      (assignee === "Todos" || t.assignee === assignee) &&
      (moduleFilter === "Todos módulos" || t.tags.includes(moduleFilter)),
  );

  function move(id: string, column: string) {
    const task = items.find((t) => t.id === id);
    if (!task) return;
    const approving = column === "Concluído" && task.column === "Em Aprovação";
    if (approving && !may("task.approve")) {
      toast.error("Seu papel não tem permissão para aprovar tarefas.");
      return;
    }
    if (!approving && !may("task.move")) {
      toast.error("Seu papel não tem permissão para mover tarefas.");
      return;
    }
    moveM.mutate({ taskId: id, column });
  }

  function handleAddColumn() {
    if (!may("task.create")) {
      toast.error("Somente gestor ou administrador pode alterar o board.");
      return;
    }
    columnM.mutate({ name: `Nova Coluna ${columns.length + 1}` });
  }

  function submitComment() {
    if (!detail || !commentDraft.trim()) return;
    if (!may("task.comment")) {
      toast.error("Seu papel não permite comentar.");
      return;
    }
    commentM.mutate({ taskId: detail.id, body: commentDraft.trim() });
    setCommentDraft("");
  }

  function handleQuickSubmit(colName: string) {
    if (!quickTitle.trim()) return;
    if (!may("task.create")) {
      toast.error("Somente gestor ou administrador pode criar tarefas.");
      return;
    }
    createM.mutate({
      title: quickTitle.trim(),
      priority: "Média",
      assignee: user?.name || "Desenvolvedor",
    });
  }

  // Card Estilo ClickUp
  function ClickUpTaskCard({ t }: { t: Task }) {
    const count = comments.filter((c) => c.taskId === t.id).length + (t.comments ?? 0);
    const pConf = priorityConfig[t.priority];

    return (
      <article
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", t.id);
          setDragging(t.id);
        }}
        onDragEnd={() => {
          setDragging(null);
          setDragOverCol(null);
        }}
        onClick={() => setDetailId(t.id)}
        className={cn(
          "group relative cursor-grab rounded-lg border border-border border-l-4 bg-card p-3 shadow-xs transition-all hover:border-brand/40 hover:shadow-md active:cursor-grabbing",
          pConf.borderColor,
          dragging === t.id && "scale-[0.98] rotate-1 opacity-50 shadow-lg",
        )}
      >
        <div className="flex items-start justify-between gap-1.5">
          <div className="flex items-start gap-1.5 min-w-0">
            <GripVertical className="size-3.5 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors mt-0.5" />
            <h3 className="line-clamp-2 text-sm font-semibold text-foreground group-hover:text-brand transition-colors">
              {t.title}
            </h3>
          </div>
          <div title={pConf.label} className="shrink-0 pt-0.5">
            <Flag className={cn("size-4", pConf.flagColor)} />
          </div>
        </div>

        {t.description ? (
          <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
        ) : null}

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {t.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-secondary/60 px-2 py-0.5 text-[10px] font-medium text-secondary-foreground"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Initials name={t.assignee} />
              <span className="max-w-[100px] truncate">{t.assignee}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {t.due ? (
              <span className="flex items-center gap-1 text-[11px] font-medium text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">
                <Clock className="size-3" /> {t.due}
              </span>
            ) : null}
            {count > 0 ? (
              <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                <MessageSquare className="size-3" /> {count}
              </span>
            ) : null}
          </div>
        </div>

        {t.column === "Em Aprovação" ? (
          <div className="mt-3 flex gap-2 pt-1 border-t border-border/40">
            <button
              onClick={(e) => {
                e.stopPropagation();
                move(t.id, "Concluído");
              }}
              className="flex flex-1 items-center justify-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-700 px-2 py-1.5 text-xs font-semibold text-white transition-colors"
            >
              <Check className="size-3.5" /> Aprovar
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                move(t.id, "Em Progresso");
              }}
              className="flex flex-1 items-center justify-center gap-1 rounded-md bg-red-600 hover:bg-red-700 px-2 py-1.5 text-xs font-semibold text-white transition-colors"
            >
              <X className="size-3.5" /> Rejeitar
            </button>
          </div>
        ) : null}
      </article>
    );
  }

  const detailComments = detail ? comments.filter((c) => c.taskId === detail.id) : [];

  return (
    <>
      <PageHeader
        icon={KanbanSquare}
        title="Tarefas"
        subtitle="Gestão ágil e acompanhamento de entregas estilo ClickUp"
      />

      {/* Toolbar estilo ClickUp com alternador de Visões (Board, List, Table) */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/80 p-2.5 shadow-xs">
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg">
          <button
            onClick={() => setView("board")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
              view === "board"
                ? "bg-card text-brand shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid className="size-3.5" /> Quadro (Board)
          </button>
          <button
            onClick={() => setView("list")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
              view === "list"
                ? "bg-card text-brand shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ListIcon className="size-3.5" /> Lista
          </button>
          <button
            onClick={() => setView("table")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
              view === "table"
                ? "bg-card text-brand shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <TableIcon className="size-3.5" /> Tabela
          </button>
        </div>

        {/* Filtros estilo ClickUp */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px]">
            <Search className="absolute top-2.5 left-3 size-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar tarefas..."
              className="w-full rounded-lg border border-input bg-card py-1.5 pr-3 pl-9 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-brand"
            />
          </div>

          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="rounded-lg border border-input bg-card px-2.5 py-1.5 text-xs font-medium text-foreground"
          >
            {["Todas", "Alta", "Média", "Baixa"].map((p) => (
              <option key={p} value={p}>
                Prioridade: {p}
              </option>
            ))}
          </select>

          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="rounded-lg border border-input bg-card px-2.5 py-1.5 text-xs font-medium text-foreground"
          >
            {assignees.map((a) => (
              <option key={a} value={a}>
                Responsável: {a}
              </option>
            ))}
          </select>

          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="rounded-lg border border-input bg-card px-2.5 py-1.5 text-xs font-medium text-foreground"
          >
            {modulesList.map((m) => (
              <option key={m} value={m}>
                Módulo: {m}
              </option>
            ))}
          </select>

          <button
            onClick={handleAddColumn}
            className="flex items-center gap-1 rounded-lg border border-input bg-card hover:bg-muted px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors"
          >
            <Plus className="size-3.5" /> Coluna
          </button>

          <button
            onClick={() => {
              if (!may("task.create")) {
                toast.error("Somente gestor ou administrador pode criar tarefas.");
                return;
              }
              setCreating(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-brand hover:bg-brand/90 px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow-xs transition-colors"
          >
            <Plus className="size-3.5" /> Nova Tarefa
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mb-6 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/60 py-12 text-center">
          <Inbox className="size-7 text-muted-foreground/60" />
          <p className="text-sm font-semibold text-foreground">Nenhuma tarefa cadastrada ainda</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Clique em "Nova Tarefa" para adicionar a primeira tarefa ou use o atalho direto nas colunas.
          </p>
        </div>
      ) : null}

      {/* Visão de Quadro (Board View - Estilo ClickUp) */}
      {view === "board" ? (
        <div className="flex gap-4 overflow-x-auto pb-4 pt-1">
          {columns.map((col) => {
            const colTasks = filtered.filter((t) => t.column === col);
            const style = columnColors[col] ?? {
              badge: "bg-secondary text-secondary-foreground",
              dot: "bg-primary",
            };

            return (
              <section
                key={col}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverCol !== col) setDragOverCol(col);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    setDragOverCol((c) => (c === col ? null : c));
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain") || dragging;
                  const task = id ? items.find((t) => t.id === id) : null;
                  if (id && task && task.column !== col) move(id, col);
                  setDragging(null);
                  setDragOverCol(null);
                }}
                className={cn(
                  "flex w-80 shrink-0 flex-col rounded-xl border border-border/80 bg-muted/20 p-3 transition-colors",
                  dragOverCol === col && dragging ? "border-brand border-dashed bg-brand/5" : "",
                )}
              >
                {/* Header da Coluna */}
                <header className="mb-3 flex items-center justify-between border-b border-border/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className={cn("size-2.5 rounded-full", style.dot)} />
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                      {col}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-bold",
                        style.badge,
                      )}
                    >
                      {colTasks.length}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      if (!may("task.create")) {
                        toast.error("Sem permissão para criar tarefas.");
                        return;
                      }
                      setQuickAddCol(col);
                    }}
                    title="Adicionar tarefa rápida nesta coluna"
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Plus className="size-4" />
                  </button>
                </header>

                {/* Quick Add em Coluna */}
                {quickAddCol === col ? (
                  <div className="mb-3 rounded-lg border border-brand/40 bg-card p-2.5 shadow-sm">
                    <input
                      autoFocus
                      value={quickTitle}
                      onChange={(e) => setQuickTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleQuickSubmit(col);
                        if (e.key === "Escape") setQuickAddCol(null);
                      }}
                      placeholder="Nome da tarefa... (Enter para salvar)"
                      className="w-full text-xs bg-transparent border-none focus:outline-hidden text-foreground"
                    />
                    <div className="mt-2 flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[11px] px-2"
                        onClick={() => setQuickAddCol(null)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        className="h-6 text-[11px] px-2 bg-brand text-brand-foreground"
                        onClick={() => handleQuickSubmit(col)}
                      >
                        Salvar
                      </Button>
                    </div>
                  </div>
                ) : null}

                {/* Lista de Cartões da Coluna */}
                <div className="flex flex-1 flex-col gap-2.5">
                  {colTasks.map((t) => (
                    <ClickUpTaskCard key={t.id} t={t} />
                  ))}
                  {colTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/80 py-12 text-center text-xs text-muted-foreground">
                      <Inbox className="size-5 opacity-40" />
                      <span>{dragging ? "Solte aqui para mover" : "Coluna vazia"}</span>
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      ) : view === "list" ? (
        /* Visão de Lista (List View - Estilo ClickUp agrupado por Coluna/Status) */
        <div className="space-y-6">
          {columns.map((col) => {
            const colTasks = filtered.filter((t) => t.column === col);
            const style = columnColors[col] ?? {
              badge: "bg-secondary text-secondary-foreground",
              dot: "bg-primary",
            };

            return (
              <div key={col} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between bg-muted/30 px-4 py-2.5 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <span className={cn("size-2.5 rounded-full", style.dot)} />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      {col}
                    </h3>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", style.badge)}>
                      {colTasks.length}
                    </span>
                  </div>
                </div>

                {colTasks.length > 0 ? (
                  <div className="divide-y divide-border/40">
                    {colTasks.map((t) => {
                      const pConf = priorityConfig[t.priority];
                      return (
                        <div
                          key={t.id}
                          onClick={() => setDetailId(t.id)}
                          className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <Flag className={cn("size-4 shrink-0", pConf.flagColor)} />
                            <span className="text-sm font-semibold text-foreground truncate">
                              {t.title}
                            </span>
                            <div className="flex gap-1">
                              {t.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded bg-secondary/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                            <span className="flex items-center gap-1 font-medium text-foreground">
                              <Initials name={t.assignee} /> {t.assignee}
                            </span>
                            {t.due ? (
                              <span className="flex items-center gap-1 text-red-500 font-medium">
                                <Clock className="size-3.5" /> {t.due}
                              </span>
                            ) : null}
                            <Badge variant="outline" className="text-[11px]">
                              {t.priority}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    Nenhuma tarefa nesta etapa.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Visão de Tabela (Table View - Estilo ClickUp) */
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border/80">
              <tr>
                <th className="px-4 py-3">Tarefa</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Prioridade</th>
                <th className="px-4 py-3">Responsável</th>
                <th className="px-4 py-3">Prazo</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.map((t) => {
                const pConf = priorityConfig[t.priority];
                const style = columnColors[t.column] ?? {
                  badge: "bg-secondary text-secondary-foreground",
                  dot: "bg-primary",
                };

                return (
                  <tr
                    key={t.id}
                    onClick={() => setDetailId(t.id)}
                    className="hover:bg-muted/20 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-semibold text-foreground max-w-xs truncate">
                      {t.title}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold", style.badge)}>
                        <span className={cn("size-1.5 rounded-full", style.dot)} />
                        {t.column}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Flag className={cn("size-3.5", pConf.flagColor)} /> {t.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 font-medium text-foreground">
                        <Initials name={t.assignee} /> {t.assignee}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {t.due ? t.due : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" className="h-7 text-xs">
                        Detalhes
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal / Drawer Detalhe da Tarefa (ClickUp 2-Column Modal Layout) */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6">
          {detail ? (
            <div className="space-y-6">
              {/* Header do Modal com Status & Prioridade estilo ClickUp */}
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-md px-2.5 py-1 text-xs font-bold uppercase", columnColors[detail.column]?.badge)}>
                    {detail.column}
                  </span>
                  <span className="text-xs text-muted-foreground">ID: {detail.id}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={cn("inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold", priorityConfig[detail.priority]?.bgColor)}>
                    <Flag className={cn("size-3.5", priorityConfig[detail.priority]?.flagColor)} />
                    {detail.priority}
                  </span>
                </div>
              </div>

              {/* Layout em 2 Colunas */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Coluna Principal (Esquerda): Título, Descrição, Comentários */}
                <div className="md:col-span-2 space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{detail.title}</h2>
                    <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line leading-relaxed bg-muted/20 p-3 rounded-lg border border-border/50">
                      {detail.description || "Sem descrição informada."}
                    </p>
                  </div>

                  {/* Tags */}
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Tags / Módulos
                    </span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {detail.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Seção de Comentários */}
                  <div className="space-y-3 pt-4 border-t border-border/60">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <MessageSquare className="size-4 text-brand" /> Atividade & Comentários
                    </h3>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {detailComments.map((c) => (
                        <div key={c.id} className="rounded-lg bg-muted/40 p-3 text-xs">
                          <div className="flex items-center justify-between font-semibold text-foreground mb-1">
                            <span>{c.authorName}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDateTime(c.at)}
                            </span>
                          </div>
                          <p className="text-muted-foreground">{c.body}</p>
                        </div>
                      ))}
                      {detailComments.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic py-2">
                          Nenhum comentário registrado nesta tarefa.
                        </p>
                      ) : null}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <input
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && submitComment()}
                        placeholder={`Comentar como ${user?.name ?? "Usuário"}...`}
                        className="flex-1 rounded-lg border border-input bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground"
                      />
                      <Button size="sm" onClick={submitComment} className="bg-brand text-brand-foreground text-xs">
                        Enviar
                      </Button>
                    </div>
                  </div>

                  {/* Trilha de Histórico da Tarefa */}
                  <div className="pt-4 border-t border-border/60">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5 mb-2">
                      <History className="size-4 text-brand" /> Histórico de Alterações
                    </h3>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {detailHistory.map((h) => (
                        <div key={h.id} className="rounded border border-border/40 p-2 text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground">{h.actor}</span>: {h.action}{" "}
                          <span className="text-[10px] opacity-75">({formatDateTime(h.at)})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sidebar de Atributos (Direita) */}
                <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4 text-xs">
                  <span className="font-bold uppercase tracking-wider text-muted-foreground text-[11px]">
                    Atributos da Tarefa
                  </span>

                  <div className="space-y-1">
                    <span className="text-muted-foreground">Responsável</span>
                    <div className="flex items-center gap-2 font-semibold text-foreground pt-0.5">
                      <Initials name={detail.assignee} />
                      <span>{detail.assignee}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-muted-foreground">Etapa / Status</span>
                    <div className="pt-0.5">
                      <span className={cn("inline-block rounded-md px-2 py-0.5 font-bold", columnColors[detail.column]?.badge)}>
                        {detail.column}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-muted-foreground">Prazo de Entrega</span>
                    <div className="font-semibold text-foreground pt-0.5 flex items-center gap-1">
                      <Calendar className="size-3.5 text-brand" />
                      {detail.due || "Sem prazo estipulado"}
                    </div>
                  </div>

                  {/* Ações de Transição de Status */}
                  <div className="pt-3 border-t border-border/60 space-y-2">
                    <span className="font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                      Mover para Etapa
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {columns
                        .filter((c) => c !== detail.column)
                        .map((c) => (
                          <Button
                            key={c}
                            variant="outline"
                            size="sm"
                            onClick={() => move(detail.id, c)}
                            className="w-full justify-start text-xs h-7"
                          >
                            <ArrowRight className="size-3 mr-1.5 text-brand" /> Mover para {c}
                          </Button>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Modal de Criação de Tarefa */}
      <Dialog open={creating} onOpenChange={(o) => !o && setCreating(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Nova Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="task-title">Título da Tarefa</Label>
              <Input
                id="task-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex.: Integrar fluxo de aprovação de notas"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="task-priority">Prioridade</Label>
                <select
                  id="task-priority"
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as Priority)}
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-xs"
                >
                  {(["Alta", "Média", "Baixa"] as Priority[]).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-due">Prazo (opcional)</Label>
                <Input
                  id="task-due"
                  value={newDue}
                  onChange={(e) => setNewDue(e.target.value)}
                  placeholder="dd/mm/aaaa"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-assignee">Responsável</Label>
              <Input
                id="task-assignee"
                value={newAssignee}
                onChange={(e) => setNewAssignee(e.target.value)}
                placeholder={user?.name ?? "Nome do responsável"}
              />
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!newTitle.trim() || createM.isPending}
              onClick={() =>
                createM.mutate({
                  title: newTitle.trim(),
                  priority: newPriority,
                  assignee: newAssignee.trim() || user?.name || "",
                  ...(newDue.trim() ? { due: newDue.trim() } : {}),
                })
              }
              className="bg-brand text-brand-foreground"
            >
              {createM.isPending ? "Criando..." : "Criar Tarefa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

