import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState, useEffect } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
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
  ArrowDownToLine,
  Eye,
} from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { Initials } from "@/components/portal/ProgressBar";
import type { Priority, Task } from "@/data/types";
import { cn } from "@/lib/utils";
import { userCan } from "@/lib/rbac";
import { formatDateTime } from "@/lib/portal-utils";
import { usePortalData, useSession, useTaskHistory, qk } from "@/lib/api-hooks";
import { moveTaskFn, createTaskFn, addColumnFn, addCommentFn, updateTaskFn } from "@/lib/portal-api";
import {
  CLIENT_STAGES,
  stageLabel,
  stageTone,
  columnToStage,
  stageToColumn,
  isWaitingOnClient,
} from "@/lib/task-stages";
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
  validateSearch: (search: Record<string, unknown>) =>
    typeof search["task"] === "string" ? { task: search["task"] } : {},
  head: () => ({
    meta: [
      { title: "Tarefas — Portal de Governança GWG — Grupo W. Geotec" },
      {
        name: "description",
        content: "ClickUp-style Task Board: backlog, execução, aprovações e entregas concluídas.",
      },
      { property: "og:title", content: "Tarefas — GWG — Grupo W. Geotec" },
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

const stageColors: Record<string, { badge: string; dot: string }> = {
  not_started: { badge: "bg-slate-500/15 text-slate-700 dark:text-slate-300", dot: "bg-slate-400" },
  in_progress: { badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  waiting_client: {
    badge: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  review: { badge: "bg-purple-500/15 text-purple-700 dark:text-purple-300", dot: "bg-purple-500" },
  done: { badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
};

function taskStage(t: Task) {
  return t.stage || columnToStage(t.column);
}

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
  Concluído: {
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
};

function TarefasPage() {
  const qc = useQueryClient();
  const { data: state } = usePortalData();
  const { data: session } = useSession();
  const search = Route.useSearch();

  const items = state?.tasks ?? [];
  const columns = state?.columns ?? [];
  const comments = state?.comments ?? [];

  const user = session?.user ?? null;
  const may = (p: Parameters<typeof userCan>[1]) => !!user && userCan(user, p);
  const isEditable = may("task.move");

  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("Todas");
  const [assignee, setAssignee] = useState("Todos");
  const [moduleFilter, setModuleFilter] = useState("Todos módulos");
  const [view, setView] = useState<"board" | "list" | "table">("board");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const ghostRef = useRef<HTMLElement | null>(null);
  const dragSrcRef = useRef<HTMLElement | null>(null);
  const boardContainerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    moved: boolean;
    pointerId: number;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const colToStage = Object.fromEntries(
    (CLIENT_STAGES as readonly string[]).map((s) => [
      stageToColumn(s as import("@/data/types").Stage),
      s as import("@/data/types").Stage,
    ]),
  ) as Record<string, import("@/data/types").Stage>;

  function resetDrag() {
    ghostRef.current?.remove();
    ghostRef.current = null;
    setDragging(null);
    setDragOverCol(null);
    dragRef.current = null;
  }

  function handleBoardPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;

    if (!d.moved) {
      const dist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
      if (dist < 8) return;
      d.moved = true;
      suppressClickRef.current = true;
      setDragging(d.id);
      const src = dragSrcRef.current;
      if (src) {
        const rect = src.getBoundingClientRect();
        const ghost = src.cloneNode(true) as HTMLElement;
        ghost.style.cssText = `position:fixed;top:${e.clientY - 24}px;left:${e.clientX + 16}px;width:${rect.width}px;pointer-events:none;transform:rotate(2deg) scale(1.02);box-shadow:0 25px 35px -5px rgba(0,0,0,0.35), 0 10px 15px -5px rgba(0,0,0,0.2);opacity:1;background:var(--card);border-radius:12px;z-index:9999;border:1.5px solid var(--brand);`;
        document.body.appendChild(ghost);
        ghostRef.current = ghost;
      }
    }

    const g = ghostRef.current;
    if (g) {
      g.style.left = `${e.clientX + 16}px`;
      g.style.top = `${e.clientY - 24}px`;
    }

    const board = boardContainerRef.current;
    if (board) {
      const rect = board.getBoundingClientRect();
      if (e.clientX - rect.left < 110) board.scrollLeft -= 22;
      else if (rect.right - e.clientX < 110) board.scrollLeft += 22;
    }

    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const colEl = hit?.closest("[data-stage-col]") as HTMLElement | null;
    const col = colEl?.getAttribute("data-stage-col") ?? null;
    setDragOverCol((c) => (c === col ? c : col));
    if (e.cancelable) e.preventDefault();
  }

  function handleBoardPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const wasMoved = d.moved;
    const id = d.id;
    dragRef.current = null;
    suppressClickRef.current = suppressClickRef.current || wasMoved;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);

    ghostRef.current?.remove();
    ghostRef.current = null;

    if (wasMoved) {
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const colEl = hit?.closest("[data-stage-col]") as HTMLElement | null;
      const col = colEl?.getAttribute("data-stage-col") ?? null;
      if (col) {
        const task = items.find((t) => t.id === id);
        if (task && task.column !== col) {
          if (colToStage[col] === "waiting_client" && !task.responsible && !task.assignee) {
            toast.error("Defina o responsável antes de mover para 'Aguardando você'.");
          } else {
            move(id, col);
          }
        }
      }
    }
    setDragging(null);
    setDragOverCol(null);
  }

  useEffect(() => {
    const cancelDrag = () => {
      if (dragRef.current) resetDrag();
    };
    window.addEventListener("pointerup", cancelDrag);
    window.addEventListener("pointercancel", cancelDrag);
    return () => {
      window.removeEventListener("pointerup", cancelDrag);
      window.removeEventListener("pointercancel", cancelDrag);
    };
  }, []);
  const [commentDraft, setCommentDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [quickAddCol, setQuickAddCol] = useState<string | null>(null);
  const [quickTitle, setQuickTitle] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("Média");
  const [newAssignee, setNewAssignee] = useState("");
  const [newDue, setNewDue] = useState("");
  const [newStage, setNewStage] = useState<import("@/data/types").Stage>("not_started");
  const [newProgress, setNewProgress] = useState<number>(0);
  const [editProgress, setEditProgress] = useState<number>(0);
  const [editResponsible, setEditResponsible] = useState("");

  const detail = items.find((t) => t.id === detailId) ?? null;
  // Deep-link: abre a tarefa indicada via ?task=<id>
  useEffect(() => {
    if (search.task && items.some((t) => t.id === search.task)) {
      setDetailId(search.task);
    }
  }, [search.task, items]);
  // Inicializa valores de edição quando o detalhe muda
  useMemo(() => {
    if (detail) {
      setEditProgress(taskStage(detail) === "done" ? 100 : Math.max(0, Math.min(100, detail.progress || 0)));
      setEditResponsible(detail.responsible || detail.assignee || "");
    }
  }, [detail?.id]);
  const { data: historyRes } = useTaskHistory(detailId);
  const detailHistory = historyRes?.ok ? historyRes.data : [];

  const moveM = useMutation({
    mutationFn: (v: { taskId: string; column: string }) => moveTaskFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.portal }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao mover a tarefa."),
  });

  const createM = useMutation({
    mutationFn: (v: { title: string; priority: Priority; assignee: string; due?: string; stage?: import("@/data/types").Stage; progress?: number }) =>
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
      setNewStage("not_started");
      setNewProgress(0);
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

  const updateTaskM = useMutation({
    mutationFn: (v: { taskId: string; progress: number; responsible: string; due?: string }) =>
      updateTaskFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.portal }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao atualizar tarefa."),
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
      assignee: user?.name || "Colaborador",
    });
  }

  // Card Estilo ClickUp Profissional (Redesign Completo + Drag Sólido Sem Transparência)
  function ClickUpTaskCard({ t }: { t: Task }) {
    const count = comments.filter((c) => c.taskId === t.id).length + (t.comments ?? 0);
    const pConf = priorityConfig[t.priority];
    const todayIso = new Date().toISOString().slice(0, 10);
    const dueIso = t.due ? t.due.split("/").reverse().join("-") : null;
    const isOverdue = !!dueIso && dueIso < todayIso && taskStage(t) !== "done";
    const dueIsToday = !!dueIso && dueIso === todayIso;
    const stage = taskStage(t);
    const pct = stage === "done" ? 100 : Math.max(0, Math.min(100, t.progress || 0));
    const isWaitingClient = isWaitingOnClient(stage) || !!t.waitingOnClient;

    if (dragging === t.id) {
      return (
        <div className="h-[96px] w-full rounded-xl border-2 border-dashed border-brand/60 bg-brand-soft/10 p-3.5 flex flex-col items-center justify-center text-center transition-all animate-pulse">
          <span className="text-xs font-bold text-brand uppercase tracking-wider">
            Espaço Reservado
          </span>
          <span className="text-[10px] text-muted-foreground mt-0.5">
            Mova para a coluna de destino
          </span>
        </div>
      );
    }

    return (
      <article
        data-task-card={t.id}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          if ((e.target as HTMLElement).closest("button")) return;
          if (!may("task.move")) return;
          dragSrcRef.current = e.currentTarget;
          dragRef.current = {
            id: t.id,
            startX: e.clientX,
            startY: e.clientY,
            moved: false,
            pointerId: e.pointerId,
          };
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* noop */
          }
        }}
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          setDetailId(t.id);
        }}
        className={cn(
          "group relative cursor-grab rounded-xl border border-border/80 border-l-[4px] bg-card p-3.5 shadow-xs transition-all duration-200 hover:border-brand/50 hover:shadow-md active:cursor-grabbing active:scale-[0.99]",
          pConf.borderColor,
          isWaitingClient ? "border-amber-400/70" : "",
        )}
      >
        {/* Header do Cartão: Grip Handle + Título + Flag de Prioridade */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-1.5 min-w-0 flex-1">
            <GripVertical className="size-3.5 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors mt-0.5 cursor-grab" />
            <h3 className="line-clamp-2 text-xs md:text-sm font-semibold text-foreground leading-snug group-hover:text-brand transition-colors">
              {t.title}
            </h3>
          </div>
          <span
            title={`Prioridade ${pConf.label}`}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              pConf.bgColor,
            )}
          >
            <Flag className="size-3" />
            {pConf.label}
          </span>
        </div>

        {/* Descrição curta */}
        {t.description ? (
          <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground leading-relaxed pl-5">
            {t.description}
          </p>
        ) : null}

        {/* Barra de Progresso */}
        <div className="mt-2 pl-5">
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                pct < 30 ? "bg-slate-400" : pct > 70 ? "bg-emerald-500" : "bg-[#0868D7]",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-[10px] font-bold text-foreground">{pct}%</span>
          </div>
        </div>

        {/* Selo Aguardando você */}
        {isWaitingClient ? (
          <div className="mt-1.5 pl-5">
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 text-[10px] font-bold border border-amber-400/30 animate-pulse">
              Aguardando você
            </span>
          </div>
        ) : null}

        {/* Tags / Módulos */}
        {t.tags && t.tags.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-1 pl-5">
            {t.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-md bg-brand-soft/40 px-2 py-0.5 text-[10px] font-medium text-brand"
              >
                <TagIcon className="size-2.5" />
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {/* Rodapé do Cartão: Avatar + Data + Comentários */}
        <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 text-xs text-muted-foreground pl-1">
          <div className="flex items-center gap-1.5">
            <Initials name={t.responsible || t.assignee} className="size-5 text-[10px] font-bold" />
            <span className="max-w-[110px] truncate text-xs font-medium text-foreground">
              {t.responsible || t.assignee}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {t.due ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[11px] font-medium rounded-md px-1.5 py-0.5",
                  isOverdue
                    ? "bg-red-500/10 text-red-600 dark:text-red-400 font-semibold"
                    : dueIsToday
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold"
                      : "bg-muted text-muted-foreground",
                )}
              >
                <Calendar className="size-3" />
                {t.due}
                {dueIsToday && " (Hoje)"}
              </span>
            ) : null}
            {count > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-muted/60 px-1.5 py-0.5 rounded-md text-muted-foreground">
                <MessageSquare className="size-3" />
                {count}
              </span>
            ) : null}
          </div>
        </div>

        {/* Barra de Ação Rápida (Em Revisão / Aprovação) */}
        {stage === "review" ? (
          <div className="mt-3 flex gap-2 pt-2 border-t border-border/40">
            <button
              onClick={(e) => {
                e.stopPropagation();
                move(t.id, "Concluído");
              }}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-2 py-1.5 text-xs font-semibold text-white transition-colors shadow-xs"
            >
              <Check className="size-3.5" /> Aprovar
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                move(t.id, "Em Progresso");
              }}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border bg-card hover:bg-muted px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors"
            >
              <X className="size-3.5" /> Devolver
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
              className="w-full rounded-lg border border-input bg-card py-1.5 pr-3 pl-9 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand"
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

          {may("task.create") ? (
          <button
            onClick={handleAddColumn}
            className="flex items-center gap-1 rounded-lg border border-input bg-card hover:bg-muted px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors"
          >
            <Plus className="size-3.5" /> Coluna
          </button>
          ) : null}

          {may("task.create") ? (
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
          ) : null}
        </div>
      </div>

      {/* Widget agregado */}
      <div className="mb-4 flex flex-wrap gap-3">
        {[
          { label: "Aguardando você", stage: "waiting_client", icon: "clock", color: "bg-amber-500/15 text-amber-700 border-amber-400/30" },
          { label: "Concluídas", stage: "done", icon: "check", color: "bg-emerald-500/15 text-emerald-700 border-emerald-400/30" },
          { label: "Em revisão", stage: "review", icon: "eye", color: "bg-purple-500/15 text-purple-700 border-purple-400/30" },
        ].map((w) => {
          const count = items.filter((t) => taskStage(t) === (w.stage as import("@/data/types").Stage)).length;
          return (
            <button
              key={w.stage}
              onClick={() => {
                const colName = stageToColumn(w.stage as import("@/data/types").Stage);
                const el = document.querySelector(`[data-stage-col="${colName}"]`) || document.querySelector(`[key="${w.stage}"]`);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold shadow-xs transition-colors hover:scale-[1.02]",
                w.color,
              )}
            >
              <span className="flex items-center gap-1">
                {w.icon === "clock" && <Clock className="size-3.5" />}
                {w.icon === "check" && <CheckCircle2 className="size-3.5" />}
                {w.icon === "eye" && <Eye className="size-3.5" />}
              </span>
              <span>{w.label}</span>
              <span className="ml-0.5 font-bold">{count}</span>
            </button>
          );
        })}
      </div>

      {items.length === 0 ? (
        <div className="mb-6 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/60 py-12 text-center">
          <Inbox className="size-7 text-muted-foreground/60" />
          <p className="text-sm font-semibold text-foreground">Nenhuma tarefa cadastrada ainda</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Clique em "Nova Tarefa" para adicionar a primeira tarefa ou use o atalho direto nas
            colunas.
          </p>
        </div>
      ) : null}

      {/* Visão de Quadro (Board View - Estilo ClickUp com Drag & Drop de alta precisão) */}
      {view === "board" ? (
        <div
          ref={boardContainerRef}
          onPointerMove={handleBoardPointerMove}
          onPointerUp={handleBoardPointerUp}
          onPointerCancel={resetDrag}
          className="flex gap-4 overflow-x-auto pb-6 pt-1 select-none scroll-smooth"
        >
          {(CLIENT_STAGES as readonly string[]).map((stage) => {
            const stageStr = stage as import("@/data/types").Stage;
            const style = stageColors[stageStr] ?? {
              badge: "bg-secondary text-secondary-foreground",
              dot: "bg-primary",
            };
            const col = stageToColumn(stageStr);
            const colTasks = filtered.filter((t) => {
              const s = taskStage(t);
              return s === stageStr;
            });
            const isDockTarget = dragOverCol === col && !!dragging;
            const isWaitingClientCol = stageStr === "waiting_client";

            return (
              <section data-stage-col={col}
                key={stageStr}
                className={cn(
                  "flex w-80 shrink-0 flex-col rounded-xl border border-border/80 p-3 transition-all duration-200 ease-out",
                  isWaitingClientCol ? "bg-amber-500/5" : "bg-muted/20",
                  isDockTarget &&
                    "scale-[1.02] border-2 border-brand bg-brand-soft/20 shadow-xl ring-4 ring-brand/20",
                )}
              >
                {/* Header da Coluna */}
                <header className="mb-3 flex items-center justify-between border-b border-border/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className={cn("size-2.5 rounded-full", style.dot)} />
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                      {stageLabel(stageStr)}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-bold",
                        isWaitingClientCol ? "bg-amber-500/30 text-amber-700 dark:text-amber-300" : style.badge,
                      )}
                    >
                      {colTasks.length}
                    </span>
                  </div>
                  {may("task.create") ? (
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
                  ) : null}
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
                      className="w-full text-xs bg-transparent border-none focus:outline-none text-foreground"
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
                  {isDockTarget ? (
                    <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-brand/60 bg-brand/10 py-8 text-center">
                      <ArrowDownToLine className="size-5 animate-bounce text-brand" />
                      <span className="text-xs font-semibold text-brand">Acoplar tarefa aqui</span>
                      <span className="text-[11px] text-muted-foreground">{col}</span>
                    </div>
                  ) : null}
                  {colTasks.length === 0 && !isDockTarget ? (
                    <div
                      className={cn(
                        "flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/80 py-12 text-center text-xs text-muted-foreground",
                        dragging && "border-brand/40 text-brand/70",
                      )}
                    >
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
          {(CLIENT_STAGES as readonly string[]).map((stage) => {
            const stageStr = stage as import("@/data/types").Stage;
            const col = stageToColumn(stageStr);
            const colTasks = filtered.filter((t) => taskStage(t) === stageStr);
            const style = stageColors[stageStr] ?? {
              badge: "bg-secondary text-secondary-foreground",
              dot: "bg-primary",
            };

            return (
              <div key={stageStr} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between bg-muted/30 px-4 py-2.5 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <span className={cn("size-2.5 rounded-full", style.dot)} />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      {stageLabel(stageStr)}
                    </h3>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-bold",
                        stageStr === "waiting_client" ? "bg-amber-500/30 text-amber-700 dark:text-amber-300" : style.badge,
                      )}
                    >
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
                          className={cn(
                            "flex items-center justify-between px-4 py-3 hover:bg-muted/20 cursor-pointer transition-colors",
                            taskStage(t) === "waiting_client" ? "bg-amber-500/5" : "",
                          )}
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
                            <span className="font-medium text-foreground text-[11px]">{(t.progress || 0)}%</span>
                            <span className="flex items-center gap-1 font-medium text-foreground max-w-[100px] truncate">
                              <Initials name={t.responsible || t.assignee} className="size-4" /> {t.responsible || t.assignee}
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
                <th className="px-4 py-3">Etapa</th>
                <th className="px-4 py-3">Progresso</th>
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
                    className={cn(
                      "hover:bg-muted/20 cursor-pointer transition-colors",
                      taskStage(t) === "waiting_client" ? "bg-amber-500/5" : "",
                    )}
                  >
                    <td className="px-4 py-3 font-semibold text-foreground max-w-xs truncate">
                      {t.title}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold",
                          stageColors[taskStage(t)]?.badge ?? "bg-secondary text-secondary-foreground",
                        )}
                      >
                        <span className={cn("size-1.5 rounded-full", stageColors[taskStage(t)]?.dot ?? "bg-primary")} />
                        {stageLabel(taskStage(t))}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] font-medium">{(t.progress || 0)}%</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Flag className={cn("size-3.5", pConf.flagColor)} /> {t.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 font-medium text-foreground max-w-[120px] truncate">
                        <Initials name={t.responsible || t.assignee} className="size-4" /> {t.responsible || t.assignee}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{t.due ? t.due : "-"}</td>
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
                  <span
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-bold uppercase",
                      stageColors[taskStage(detail)]?.badge ?? stageColors["not_started"]?.badge,
                    )}
                  >
                    {stageLabel(taskStage(detail))}
                  </span>
                  <span className="text-xs text-muted-foreground">ID: {detail.id}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold",
                      priorityConfig[detail.priority]?.bgColor,
                    )}
                  >
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
                      <Button
                        size="sm"
                        onClick={submitComment}
                        className="bg-brand text-brand-foreground text-xs"
                      >
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
                        <div
                          key={h.id}
                          className="rounded border border-border/40 p-2 text-[11px] text-muted-foreground"
                        >
                          <span className="font-semibold text-foreground">{h.actor}</span>:{" "}
                          {h.action}{" "}
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

                  {/* Progresso */}
                  <div className="space-y-2">
                    <span className="text-muted-foreground">Progresso</span>
                    {isEditable ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={editProgress || (detail ? (taskStage(detail) === "done" ? 100 : Math.max(0, Math.min(100, detail.progress || 0))) : 0)}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setEditProgress(val);
                            if (!detail) return;
                            updateTaskM.mutate({
                              taskId: detail.id,
                              progress: val,
                              responsible: editResponsible || detail.responsible || detail.assignee || "",
                            });
                          }}
                          onClick={() => {
                            if (detail) {
                              setEditProgress(taskStage(detail) === "done" ? 100 : Math.max(0, Math.min(100, detail.progress || 0)));
                              setEditResponsible(detail.responsible || detail.assignee || "");
                            }
                          }}
                          className="flex-1 h-1.5"
                        />
                        <span className="text-xs font-bold w-8 text-right">
                          {editProgress !== undefined ? editProgress : (detail ? (taskStage(detail) === "done" ? 100 : Math.max(0, Math.min(100, detail.progress || 0))) : 0)}%
                        </span>
                      </div>
                    ) : (
                      <div className="pt-0.5">
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-brand"
                            style={{ width: `${detail.progress || 0}%` }}
                          />
                        </div>
                        <span className="mt-1 inline-block pl-0.5 text-[11px] font-bold text-muted-foreground">
                          {detail.progress || 0}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Responsável */}
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Responsável</span>
                    {isEditable ? (
                      <div className="pt-0.5 flex items-center gap-2">
                        <Input
                          id="detail-responsible"
                          value={editResponsible || (detail ? (detail.responsible || detail.assignee || "") : "")}
                          onChange={(e) => {
                            const val = e.target.value.trim();
                            setEditResponsible(val);
                          }}
                          placeholder="Nome do responsável"
                          className="h-7 text-xs px-2 py-1 flex-1"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px] px-2"
                          onClick={() => {
                            if (!detail) return;
                            const val = (editResponsible || detail.responsible || detail.assignee || "").trim();
                            if (val !== (detail.responsible || detail.assignee || "")) {
                              updateTaskM.mutate({
                                taskId: detail.id,
                                progress: editProgress || detail.progress || 0,
                                responsible: val,
                              });
                            }
                          }}
                        >
                          Salvar
                        </Button>
                      </div>
                    ) : (
                      <div className="pt-0.5 flex items-center gap-1.5 font-semibold text-foreground">
                        <Initials name={detail.responsible || detail.assignee || ""} />
                        {detail.responsible || detail.assignee || "—"}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <span className="text-muted-foreground">Etapa / Status</span>
                    <div className="pt-0.5">
                      <span
                        className={cn(
                          "inline-block rounded-md px-2 py-0.5 font-bold",
                          stageColors[taskStage(detail)]?.badge ?? stageColors["not_started"]?.badge,
                        )}
                      >
                        {stageLabel(taskStage(detail))}
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

                  {isEditable && (
                  <div className="pt-3 border-t border-border/60 space-y-2">
                    <span className="font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                      Mover para Etapa
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {(CLIENT_STAGES as readonly string[])
                        .filter((s) => stageToColumn(s as import("@/data/types").Stage) !== stageToColumn(taskStage(detail)))
                        .map((s) => {
                          const stageStr = s as import("@/data/types").Stage;
                          const colName = stageToColumn(stageStr);
                          return (
                            <Button
                              key={stageStr}
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (stageStr === "waiting_client" && !detail?.responsible && !detail?.assignee) {
                                  toast.error("Defina o responsável antes de mover para 'Aguardando você'.");
                                  return;
                                }
                                move(detail!.id, colName);
                              }}
                              className="w-full justify-start text-xs h-7"
                            >
                              <ArrowRight className="size-3 mr-1.5 text-brand" /> Mover para {stageLabel(stageStr)}
                            </Button>
                          );
                        })}
                    </div>
                  </div>
                  )}
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="task-stage">Etapa inicial</Label>
                <select
                  id="task-stage"
                  value={newStage}
                  onChange={(e) => setNewStage(e.target.value as import("@/data/types").Stage)}
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-xs"
                >
                  {(CLIENT_STAGES as readonly string[]).map((s) => (
                    <option key={s} value={s}>
                      {stageLabel(s as import("@/data/types").Stage)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-progress">Progresso inicial</Label>
                <input
                  id="task-progress"
                  type="number"
                  min={0}
                  max={100}
                  value={newProgress}
                  onChange={(e) => setNewProgress(Math.max(0, Math.min(100, parseInt(e.target.value || "0", 10))))}
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-xs"
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
              disabled={!newTitle.trim() || createM.isPending || (newStage === "waiting_client" && !newAssignee.trim())}
              onClick={() => {
                if (newStage === "waiting_client" && !newAssignee.trim()) {
                  toast.error("Defina o responsável para tarefas em 'Aguardando você'.");
                  return;
                }
                createM.mutate({
                  title: newTitle.trim(),
                  priority: newPriority,
                  assignee: newAssignee.trim() || user?.name || "",
                  ...(newDue.trim() ? { due: newDue.trim() } : {}),
                  stage: newStage,
                  progress: newProgress,
                });
              }}
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
